"use server"

import { createServerClient, shouldUseSupabase, isTableNotFoundError } from "@/lib/supabase/server"
import { mockStore } from "@/lib/mock-data-store"
import { revalidatePath } from "next/cache"
import { ArticuloSchema, validateOrThrow } from "@/lib/validations/schemas"

export type EstadoArticulo = "disponible" | "alquilado" | "mantenimiento" | "baja"
export type CategoriaArticulo = "mobiliario" | "iluminacion" | "sonido" | "video" | "decoracion" | "otros"

export interface Articulo {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  categoria: CategoriaArticulo
  precio_dia: number
  stock_total: number
  stock_disponible: number
  estado: EstadoArticulo
  imagenes: string[]
  coste_compra?: number
  fecha_compra?: string
  proveedor?: string
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface ArticulosResponse {
  success: boolean
  data: Articulo[]
  error?: string
}

export async function getArticulos(filters?: { 
  categoria?: CategoriaArticulo
  estado?: EstadoArticulo
  search?: string 
}): Promise<ArticulosResponse> {
  if (!shouldUseSupabase()) {
    let articulos = mockStore.getArticulos()

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      articulos = articulos.filter(
        (a) =>
          a.nombre.toLowerCase().includes(searchLower) ||
          a.descripcion.toLowerCase().includes(searchLower) ||
          a.codigo.toLowerCase().includes(searchLower),
      )
    }

    if (filters?.categoria && filters.categoria !== "todas") {
      articulos = articulos.filter((a) => a.categoria === filters.categoria)
    }

    return { success: true, data: articulos }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return { success: true, data: mockStore.getArticulos() }
  }

  try {
    let query = supabase.from("articulos").select("*").order("created_at", { ascending: false })

    if (filters?.categoria && filters.categoria !== "todas") {
      query = query.eq("categoria", filters.categoria)
    }

    if (filters?.estado && filters.estado !== "todos") {
      query = query.eq("estado", filters.estado)
    }

    if (filters?.search) {
      query = query.or(`nombre.ilike.%${filters.search}%,descripcion.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      if (isTableNotFoundError(error)) {
        // Silenciosamente usar datos mock cuando las tablas no existen
        return { success: true, data: mockStore.getArticulos() }
      }
      console.error("[v0] Error obteniendo artículos:", error)
      return { success: true, data: mockStore.getArticulos() }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    // Usar mock como fallback
    return { success: true, data: mockStore.getArticulos() }
  }
}

interface CreateArticuloData {
  nombre: string
  descripcion: string
  categoria: CategoriaArticulo
  precio_alquiler: number
  cantidad_disponible: number
  cantidad_total: number
  estado: EstadoArticulo
  imagen_url?: string
  imagenes?: string[]
  coste_compra?: number
  fecha_compra?: string
  proveedor?: string
  entidades?: string[]
}

export interface ArticuloResponse {
  success: boolean
  data?: Articulo
  error?: string
}

export async function createArticulo(formData: CreateArticuloData): Promise<ArticuloResponse> {
  if (!shouldUseSupabase()) {
    const newArticulo = mockStore.addArticulo({
      codigo: `ART-${Date.now()}`,
      nombre: formData.nombre,
      categoria: formData.categoria,
      descripcion: formData.descripcion,
      precio_dia: formData.precio_alquiler,
      stock_total: formData.cantidad_total,
      stock_disponible: formData.cantidad_disponible,
      imagenes: formData.imagenes || (formData.imagen_url ? [formData.imagen_url] : []),
    })
    revalidatePath("/articulos")
    return { success: true, data: newArticulo }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    // Validación con Zod (validamos los campos principales y mapeamos nombres)
    try {
      const toValidate = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        precio: formData.precio_alquiler,
      }
      validateOrThrow(ArticuloSchema, toValidate)
    } catch (validationError: any) {
      return { success: false, error: validationError.message || "Datos inválidos" }
    }

    // Validar imagenes si vienen
    if (formData.imagenes && formData.imagenes.length > 0) {
      if (formData.imagenes.length > 10) {
        return { success: false, error: "Máximo 10 imágenes por artículo" }
      }
      for (const url of formData.imagenes) {
        if (typeof url !== 'string' || !url.trim()) {
          return { success: false, error: "URL de imagen no válida" }
        }
      }
    }

    // Validar entidades si se proporcionan
    if (formData.entidades && formData.entidades.length > 0) {
      const uniques = new Set(formData.entidades)
      if (uniques.size !== formData.entidades.length) {
        return { success: false, error: "Códigos de entidad duplicados" }
      }
    }

    const articuloData = {
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim(),
      categoria: formData.categoria,
      precio_dia: formData.precio_alquiler,
      stock_total: formData.cantidad_total,
      stock_disponible: formData.cantidad_disponible,
      estado: formData.estado,
      imagenes: formData.imagenes || [],
      coste_compra: formData.coste_compra,
      fecha_compra: formData.fecha_compra,
      proveedor: formData.proveedor?.trim(),
      activo: true,
      codigo: `ART-${Date.now().toString(36).toUpperCase()}`
    }

    const { data: existente, error: checkError } = await supabase
      .from("articulos")
      .select("id")
      .eq("nombre", articuloData.nombre)
      .limit(1)

    if (checkError) {
      throw checkError
    }

    if (existente?.length > 0) {
      return { 
        success: false, 
        error: "Ya existe un artículo con ese nombre" 
      }
    }

    const { data: articulo, error: articuloError } = await supabase
      .from("articulos")
      .insert([articuloData])
      .select()
      .single()

    if (articuloError) throw articuloError

    if (formData.entidades && formData.entidades.length > 0) {
      const entidadesData = formData.entidades.map((codigo) => ({
        articulo_id: articulo.id,
        codigo_unico: codigo,
        estado: "disponible",
        ubicacion: null,
        notas: null,
      }))

      const { error: entidadesError } = await supabase.from("entidades_articulos").insert(entidadesData)

      if (entidadesError) {
        console.error("[v0] Error creando entidades:", entidadesError)
        // No fallar si las entidades no se crean, el artículo ya está creado
      }
    }

    revalidatePath("/articulos")
    return { success: true, data: articulo }
  } catch (error) {
    console.error("[v0] Error creando artículo:", error)
    return { success: false, error: "Error al crear artículo" }
  }
}

export async function updateArticulo(
  id: string,
  formData: Partial<CreateArticuloData>
): Promise<ArticuloResponse> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "ID de artículo no válido" }
    }

    // Validaciones de campos proporcionados (validación parcial con Zod)
    try {
      const PartialArticulo = ArticuloSchema.partial()
      const toValidate: any = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        precio: formData.precio_alquiler,
      }
      // Sólo validar los campos que se hayan proporcionado
      const provided: any = {}
      Object.keys(toValidate).forEach((k) => {
        if (toValidate[k] !== undefined) provided[k] = toValidate[k]
      })
      if (Object.keys(provided).length > 0) validateOrThrow(PartialArticulo, provided)
    } catch (validationError: any) {
      return { success: false, error: validationError.message || "Datos inválidos" }
    }

    if (!shouldUseSupabase()) {
      const updated = mockStore.updateArticulo(id, {
        nombre: formData.nombre,
        categoria: formData.categoria,
        descripcion: formData.descripcion,
        precio_dia: formData.precio_alquiler,
        stock_total: formData.cantidad_total,
        stock_disponible: formData.cantidad_disponible,
        imagenes: formData.imagenes || (formData.imagen_url ? [formData.imagen_url] : undefined),
      })

      if (!updated) {
        return { success: false, error: "Artículo no encontrado" }
      }

      revalidatePath("/articulos")
      return { success: true, data: updated }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, error: "Error de configuración: Supabase no está inicializado" }
    }

    // Verificar que el artículo existe
    const { data: existente, error: checkError } = await supabase
      .from("articulos")
      .select("stock_total, stock_disponible")
      .eq("id", id)
      .single()

    if (checkError) {
      throw checkError
    }

    if (!existente) {
      return { success: false, error: "Artículo no encontrado" }
    }

    // Validar que la nueva cantidad disponible no exceda el total
    if (formData.cantidad_disponible !== undefined) {
      const nuevoTotal = formData.cantidad_total ?? existente.stock_total
      if (formData.cantidad_disponible > nuevoTotal) {
        return { 
          success: false, 
          error: "La cantidad disponible no puede ser mayor que la cantidad total" 
        }
      }
    }

    // Verificar nombre duplicado si se está actualizando
    if (formData.nombre) {
      const { data: duplicado, error: dupError } = await supabase
        .from("articulos")
        .select("id")
        .eq("nombre", formData.nombre)
        .neq("id", id)
        .limit(1)

      if (dupError) {
        throw dupError
      }

      if (duplicado?.length > 0) {
        return { 
          success: false, 
          error: "Ya existe otro artículo con ese nombre" 
        }
      }
    }

    const updateData: any = {
      ...formData,
      nombre: formData.nombre?.trim(),
      descripcion: formData.descripcion?.trim(),
      proveedor: formData.proveedor?.trim(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("articulos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/articulos")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error actualizando artículo:", error)
    return { 
      success: false, 
      error: "Error al actualizar artículo. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export async function deleteArticulo(id: string): Promise<{
  success: boolean
  error?: string
}> {
  if (!shouldUseSupabase()) {
    mockStore.deleteArticulo(id)
    revalidatePath("/articulos")
    return { success: true }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    // Comprobar dependencias (entidades o historial) antes de eliminar
    const { data: vinculadas, error: vincError } = await supabase
      .from("entidades_articulos")
      .select("id")
      .eq("articulo_id", id)
      .limit(1)

    if (vincError) throw vincError

    if (vinculadas && vinculadas.length > 0) {
      return { success: false, error: "No se puede eliminar: existen entidades asociadas al artículo" }
    }

    const { error } = await supabase.from("articulos").delete().eq("id", id)

    if (error) throw error

    revalidatePath("/articulos")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error eliminando artículo:", error)
    return { success: false, error: "Error al eliminar artículo" }
  }
}

export async function getArticuloById(id: string): Promise<ArticuloResponse> {
  if (!shouldUseSupabase()) {
    const articulo = mockStore.getArticulo(id)
    return { success: true, data: articulo }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    const { data, error } = await supabase.from("articulos").select("*").eq("id", id).maybeSingle()

    if (error) throw error

    return { success: true, data: data || undefined }
  } catch (error) {
    console.error("[v0] Error obteniendo artículo:", error)
    return { success: false, error: "Error al obtener artículo" }
  }
}

interface HistorialArticulo {
  id: string
  articulo_id: string
  pedido_id: string
  fecha_inicio: string
  fecha_fin: string
  estado: string
  notas?: string
  pedido?: {
    numero_pedido: string
    fecha_pedido: string
    fecha_entrega: string
    fecha_devolucion: string
  }
}

interface HistorialResponse {
  success: boolean
  data: HistorialArticulo[]
  error?: string
}

export async function getHistorialArticulo(articuloId: string): Promise<HistorialResponse> {
  try {
    if (!articuloId?.trim()) {
      return { 
        success: false, 
        data: [], 
        error: "ID de artículo no válido" 
      }
    }

    if (!shouldUseSupabase()) {
      return { success: true, data: [] }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { 
        success: false, 
        data: [], 
        error: "Error de configuración: Supabase no está inicializado" 
      }
    }

    // Primero verificar que el artículo existe
    const { data: articulo, error: articuloError } = await supabase
      .from("articulos")
      .select("id")
      .eq("id", articuloId)
      .single()

    if (articuloError) {
      throw articuloError
    }

    if (!articulo) {
      return { 
        success: false, 
        data: [], 
        error: "Artículo no encontrado" 
      }
    }

    const { data, error } = await supabase
      .from("historial_articulos")
      .select(`
        *,
        pedidos:pedido_id (
          numero_pedido,
          fecha_pedido,
          fecha_entrega,
          fecha_devolucion
        )
      `)
      .eq("articulo_id", articuloId)
      .order("fecha_inicio", { ascending: false })

    if (error) {
      throw error
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[v0] Error obteniendo historial:", error)
    return { 
      success: false, 
      data: [], 
      error: "Error al obtener historial. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}
