"use server"

import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"]

export interface UploadResponse {
  success: boolean
  url?: string
  path?: string
  error?: string
}

export async function uploadImage(formData: FormData): Promise<UploadResponse> {
  try {
    const supabase = await createClient()

    const file = formData.get("file") as File
    if (!file) {
      return { success: false, error: "No se proporcionó archivo" }
    }

    // Validaciones básicas
    if (file.size > MAX_IMAGE_SIZE) {
      return { success: false, error: `El archivo excede el tamaño máximo de ${MAX_IMAGE_SIZE} bytes` }
    }

      // Validar MIME type si está disponible
      if (file.type && !file.type.startsWith("image/")) {
        return { success: false, error: "Tipo de archivo no permitido (se requiere imagen)" }
      }

    const fileExt = (file.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXT.includes(fileExt)) {
      return { success: false, error: `Tipo de archivo no permitido. Extensiones permitidas: ${ALLOWED_EXT.join(", ")}` }
    }

    console.log("[v0] Subiendo imagen:", file.name, "Tamaño:", file.size)

    // Generar nombre único para el archivo
  // Generar nombre único para el archivo (limitamos longitud razonable)
  const baseName = String(file.name).replace(/[^a-zA-Z0-9-_\.]/g, "-").slice(0, 40)
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${baseName}.${fileExt}`.slice(0, 255)
    const filePath = `articulos/${fileName}`

    // Subir archivo a Supabase Storage
    const { data, error } = await supabase.storage.from("imagenes").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      console.error("[v0] Error subiendo imagen a Supabase Storage:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Imagen subida exitosamente:", data)

    // Obtener URL pública
  const { data: publicData } = supabase.storage.from("imagenes").getPublicUrl(filePath)
  // publicData typically has shape { publicUrl }
  const publicUrl = (publicData as any)?.publicUrl ?? null

    console.log("[v0] URL pública generada:", publicUrl)

    return { success: true, url: publicUrl, path: filePath }
  } catch (error: any) {
    console.error("[v0] Error en uploadImage:", error)
    return { success: false, error: error.message || "Error al subir imagen" }
  }
}

export async function deleteImage(path: string): Promise<UploadResponse> {
  try {
    if (!path || !path.trim()) return { success: false, error: "Ruta de imagen no válida" }

    // Protección básica contra path traversal o rutas absolutas
    if (path.includes("..") || path.startsWith("/")) {
      return { success: false, error: "Ruta de imagen no válida" }
    }

    const supabase = await createClient()

    const { error } = await supabase.storage.from("imagenes").remove([path])

    if (error) {
      console.error("[v0] Error eliminando imagen:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error en deleteImage:", error)
    return { success: false, error: error.message || "Error al eliminar imagen" }
  }
}
