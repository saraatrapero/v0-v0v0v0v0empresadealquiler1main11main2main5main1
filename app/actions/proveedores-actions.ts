"use server"

import { createServerClient, shouldUseSupabase } from "@/lib/supabase/server"
import { ProveedorSchema, validateOrThrow } from "@/lib/validations/schemas"
import { revalidatePath } from "next/cache"

export interface Proveedor {
  id: string
  nombre: string
  contacto?: string
  telefono?: string
  email?: string
  direccion?: string
  cif?: string
  notas?: string
  activo: boolean
}

export interface ProveedorCreateData {
  nombre: string
  contacto?: string
  telefono?: string
  email?: string
  direccion?: string
  cif?: string
  notas?: string
}

export interface ProveedoresResponse {
  success: boolean
  data?: Proveedor[]
  error?: string
}

export async function getProveedores(search?: string): Promise<ProveedoresResponse> {
  if (!shouldUseSupabase()) {
    // Mock data
    const mockProveedores: Proveedor[] = [
      {
        id: "1",
        nombre: "Muebles García S.L.",
        contacto: "Juan García",
        telefono: "912345678",
        email: "info@mueblesgarcia.com",
        activo: true,
      },
      {
        id: "2",
        nombre: "Eventos Pro",
        contacto: "María López",
        telefono: "923456789",
        email: "ventas@eventospro.com",
        activo: true,
      },
      {
        id: "3",
        nombre: "Iluminación Total",
        contacto: "Pedro Martínez",
        telefono: "934567890",
        email: "contacto@iluminaciontotal.com",
        activo: true,
      },
    ]

    if (search) {
      const searchLower = search.toLowerCase()
      return { success: true, data: mockProveedores.filter((p) => p.nombre.toLowerCase().includes(searchLower)) }
    }

    return { success: true, data: mockProveedores }
  }

  const supabase = createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado", data: [] }
  }

  try {
    let query = supabase.from("proveedores").select("*").eq("activo", true).order("nombre", { ascending: true })

    if (search) {
      query = query.ilike("nombre", `%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[v0] Error obteniendo proveedores:", error)
    return { success: false, error: "Error al obtener proveedores" }
  }
}
export async function createProveedor(formData: ProveedorCreateData): Promise<{ success: boolean; data?: Proveedor; error?: string }> {
  // Sanitizar
  const nombre = formData.nombre?.trim()
  const contacto = formData.contacto?.trim() || null
  const telefono = formData.telefono?.trim() || null
  const email = formData.email?.trim().toLowerCase() || null
  const direccion = formData.direccion?.trim() || null
  const cif = formData.cif?.trim().toUpperCase() || null
  const notas = formData.notas?.trim() || null

  // Validaciones
  try {
    validateOrThrow(ProveedorSchema, { nombre, email, telefono, direccion, cif })
  } catch (validationError: any) {
    return { success: false, error: validationError.message || "Datos inválidos" }
  }

  if (!shouldUseSupabase()) {
    return { success: true, data: { id: Date.now().toString(), nombre, contacto, telefono, email, direccion, cif, notas, activo: true } }
  }

  const supabase = createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    // Comprobar duplicados por CIF o email
    if (cif) {
      const { data: existenteCif, error: cifErr } = await supabase.from("proveedores").select("id").eq("cif", cif).maybeSingle()
      if (cifErr) throw cifErr
      if (existenteCif) return { success: false, error: "Ya existe un proveedor con ese CIF" }
    }

    if (email) {
      const { data: existenteEmail, error: emailErr } = await supabase.from("proveedores").select("id").eq("email", email).maybeSingle()
      if (emailErr) throw emailErr
      if (existenteEmail) return { success: false, error: "Ya existe un proveedor con ese email" }
    }

    const { data, error } = await supabase
      .from("proveedores")
      .insert([{ nombre, contacto, telefono, email, direccion, cif, notas, activo: true }])
      .select()
      .single()

    if (error) throw error

    revalidatePath("/articulos")
    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Error creando proveedor:", error)
    if (error?.code === "23505") {
      return { success: false, error: "Conflicto: proveedor duplicado" }
    }
    return { success: false, error: error?.message || "Error al crear proveedor" }
  }
}
