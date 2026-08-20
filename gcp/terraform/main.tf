terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    bucket = "healthwatch-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "asia-south1-a"
}

variable "cluster_name" {
  default = "healthwatch-cluster"
}

variable "node_count" {
  default = 2
}

variable "machine_type" {
  default = "e2-standard-4"  # 4 vCPU, 16GB RAM per node
}

# ── Networking ──────────────────────────────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = "healthwatch-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "healthwatch-subnet"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.10.0.0/16"

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/14"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.24.0.0/20"
  }
}

# ── GKE Cluster ────────────────────────────────────────────────────────

resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.zone

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # Autopilot vs Standard: we use Standard for HPA control
  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Security
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Networking
  networking_mode = "VPC_NATIVE"
}

resource "google_container_node_pool" "primary_nodes" {
  name     = "primary-pool"
  location = var.zone
  cluster  = google_container_cluster.primary.name

  initial_node_count = var.node_count

  autoscaling {
    min_node_count = 1
    max_node_count = 10  # Scales up to 40 vCPU / 160GB RAM
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 50
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = {
      app = "healthwatch"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ── Cloud SQL (PostgreSQL + PostGIS) ───────────────────────────────────

resource "google_sql_database_instance" "postgres" {
  name                = "healthwatch-db"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = false

  settings {
    tier              = "db-custom-4-16384"  # 4 vCPU, 16GB RAM
    availability_type = "REGIONAL"           # HA failover

    disk_size    = 50
    disk_type    = "PD_SSD"

    backup_configuration {
      enabled          = true
      start_time       = "03:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    database_flags {
      name  = "max_connections"
      value = "400"
    }
  }
}

resource "google_sql_database" "healthwatch" {
  name     = "healthwatch"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "default" {
  name     = "healthwatch"
  instance = google_sql_database_instance.postgres.name
  password = "CHANGE_ME_USE_SECRETS"
}

# ── Memorystore (Redis) ───────────────────────────────────────────────

resource "google_redis_instance" "cache" {
  name           = "healthwatch-redis"
  memory_size_gb = 2               # 2GB for 10k+ users
  region         = var.region
  tier           = "STANDARD_HA"   # HA with automatic failover

  redis_version  = "REDIS_7_0"
  display_name   = "HealthWatch Cache"

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  persistence_config {
    persistence_mode = "RDB"
    rdb_snapshot_period = "TWENTY_FOUR_HOURS"
  }
}

# ── Cloud CDN (static asset caching) ──────────────────────────────────

resource "google_compute_global_address" "healthwatch_ip" {
  name = "healthwatch-ip"
}

# ── Firewall ───────────────────────────────────────────────────────────

resource "google_compute_firewall" "allow_health" {
  name    = "healthwatch-allow-health"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["healthwatch"]
}

# ── Outputs ────────────────────────────────────────────────────────────

output "gke_cluster_name" {
  value = google_container_cluster.primary.name
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "static_ip" {
  value = google_compute_global_address.healthwatch_ip.address
}

output "cloud_sql_private_ip" {
  value = google_sql_database_instance.postgres.private_ip_address
}
