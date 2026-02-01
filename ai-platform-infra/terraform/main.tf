provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  preview_hostname = "*.${var.preview_subdomain}"
  platform_hostname = var.platform_domain
}

resource "cloudflare_kv_namespace" "tenant_config" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_title
}

resource "cloudflare_r2_bucket" "app_assets" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
}

resource "cloudflare_worker_script" "edge_router" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  content    = file("${path.module}/workers/edge-router.js")

  plain_text_binding {
    name = "PLATFORM_DOMAIN"
    text = var.platform_domain
  }

  kv_namespace_binding {
    name         = "TENANT_CONFIG"
    namespace_id = cloudflare_kv_namespace.tenant_config.id
  }

  r2_bucket_binding {
    name        = "APP_ASSETS"
    bucket_name = cloudflare_r2_bucket.app_assets.name
  }
}

resource "cloudflare_worker_route" "preview_router" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "${local.preview_hostname}/*"
  script_name = cloudflare_worker_script.edge_router.name
}

resource "cloudflare_record" "preview_wildcard" {
  zone_id = var.cloudflare_zone_id
  name    = "*.${var.preview_subdomain}"
  type    = "CNAME"
  value   = local.platform_hostname
  ttl     = 3600
  proxied = true
}

resource "cloudflare_record" "platform_root" {
  zone_id = var.cloudflare_zone_id
  name    = var.platform_domain
  type    = "CNAME"
  value   = "pages.dev"
  ttl     = 3600
  proxied = true
}
