variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token with Workers, KV, R2, and DNS permissions."
  sensitive   = true
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID for Workers, KV, and R2."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for platform.com."
}

variable "platform_domain" {
  type        = string
  description = "Primary platform domain (e.g. platform.com)."
}

variable "preview_subdomain" {
  type        = string
  description = "Wildcard subdomain for preview apps (e.g. preview.platform.com)."
}

variable "worker_name" {
  type        = string
  default     = "ai-platform-router"
  description = "Worker name for edge routing."
}

variable "worker_routes" {
  type        = list(string)
  description = "Routes for the edge worker (e.g. [""*.preview.platform.com/*""])."
}

variable "r2_bucket_name" {
  type        = string
  default     = "generated-app-assets"
  description = "R2 bucket for generated app bundles and assets."
}

variable "kv_namespace_title" {
  type        = string
  default     = "tenant-config"
  description = "KV namespace title for tenant configuration."
}

variable "supabase_project_url" {
  type        = string
  description = "Supabase project URL used by the platform services."
}

variable "supabase_anon_key" {
  type        = string
  description = "Supabase anon key for browser clients."
  sensitive   = true
}

variable "supabase_service_role_key" {
  type        = string
  description = "Supabase service role key for backend services."
  sensitive   = true
}

variable "llm_gateway_url" {
  type        = string
  description = "URL for the LLM gateway (Cloudflare Worker endpoint)."
}
