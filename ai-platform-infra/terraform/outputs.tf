output "worker_name" {
  value       = cloudflare_worker_script.edge_router.name
  description = "Edge router Worker name."
}

output "tenant_config_namespace_id" {
  value       = cloudflare_kv_namespace.tenant_config.id
  description = "KV namespace ID for tenant config."
}

output "app_assets_bucket" {
  value       = cloudflare_r2_bucket.app_assets.name
  description = "R2 bucket for generated app assets."
}

output "supabase_project_url" {
  value       = var.supabase_project_url
  description = "Supabase project URL referenced by services."
}
