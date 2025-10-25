"use server"

import { createServerClient, shouldUseSupabase } from "@/lib/supabase/server"
import { mockStore } from "@/lib/mock-data-store"
import { revalidatePath } from "next/cache"
import { PedidoSchema, validateOrThrow } from "@/lib/validations/schemas"

export async function getPedidos(filters?: {
  estado?: string
  search?: string
  fechaDesde?: string
  fechaHasta?: string
}) {
  if (!shouldUseSupabase()) {
    console.log("[v0] Usando datos mock para pedidos")
    let pedidos = mockStore.getReservas()

    if (filters?.estado && filters.estado !== "todos") {
      pedidos = pedidos.filter((p) => p.estado === filters.estado)
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      pedidos = pedidos.filter(
        (p) =>
          p.numeroPedido.toLowerCase().includes(searchLower) ||
          p.cliente.toLowerCase().includes(searchLower) ||
          p.empresa?.toLowerCase().includes(searchLower) ||
          p.telefono.includes(searchLower) ||
          p.email.toLowerCase().includes(searchLower),
      )
    }

    if (filters?.fechaDesde) {
      pedidos = pedidos.filter((p) => p.fecha_desde >= filters.fechaDesde!)
    }

    if (filters?.fechaHasta) {
      pedidos = pedidos.filter((p) => p.fecha_desde <= filters.fechaHasta!)
    }

    return { success: true, data: pedidos }
  }

  const supabase = createServerClient()
  if (!supabase) {
    console.log("[v0] Supabase no disponible, usando mock")
    return { success: true, data: mockStore.getReservas() }
  }

  try {
    let query = supabase
      .from("pedidos")
      .select(`
        *,
        usuarios:cliente_id (
          nombre,
          email,
          telefono
        )
      `)
      .order("fecha_pedido", { ascending: false })

    if (filters?.estado && filters.estado !== "todos") {
      query = query.eq("estado", filters.estado)
    }

    if (filters?.search) {
      query = query.or(`numero_pedido.ilike.%${filters.search}%`)
    }

    if (filters?.fechaDesde) {
      query = query.gte("fecha_pedido", filters.fechaDesde)
    }

    if (filters?.fechaHasta) {
      query = query.lte("fecha_pedido", filters.fechaHasta)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error obteniendo pedidos de Supabase, usando mock:", error)
      return { success: true, data: mockStore.getReservas() }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[v0] Error obteniendo pedidos, usando mock:", error)
    return { success: true, data: mockStore.getReservas() }
  }
}

export async function createPedido(formData: {
  cliente_id: string
  cliente_nombre?: string
  empresa?: string
  telefono?: string
  email?: string
  fecha_pedido: string
  fecha_entrega: string
  fecha_devolucion: string
  direccion_entrega?: string
  calle?: string
  codigo_postal?: string
  ciudad?: string
  estado: string
  notas?: string
  articulos?: Array<{ articulo_id: string; cantidad: number; precio_unitario: number; nombre?: string }>
  total?: number
}) {
  // Validación y sanitización básica
  if (!formData || !formData.cliente_id?.trim()) {
    return { success: false, error: "El cliente es requerido" }
  }

  if (!formData.fecha_entrega || !formData.fecha_devolucion) {
    return { success: false, error: "Fechas de entrega y devolución son obligatorias" }
  }

  if (!formData.articulos || formData.articulos.length === 0) {
    return { success: false, error: "Debe especificar al menos un artículo en el pedido" }
  }

  // Sanitizar articulos y calcular total si no viene
  formData.articulos = formData.articulos.map((a) => ({
    articulo_id: a.articulo_id,
    cantidad: Number(a.cantidad) || 0,
    precio_unitario: Number(a.precio_unitario) || 0,
    nombre: a.nombre?.trim(),
  }))

  const calculadoTotal = formData.articulos.reduce((s, a) => s + a.cantidad * a.precio_unitario, 0)
  formData.total = Number(formData.total) || calculadoTotal

  // Validar estructura del pedido con Zod (mapeamos precio_unitario -> precio)
  try {
    const toValidate = {
      cliente_id: formData.cliente_id,
      articulos: formData.articulos.map((a) => ({ articulo_id: a.articulo_id, cantidad: a.cantidad, precio: a.precio_unitario })),
    }
    validateOrThrow(PedidoSchema, toValidate)
  } catch (validationError: any) {
    return { success: false, error: validationError.message || "Datos inválidos", details: validationError.details }
  }

  if (!shouldUseSupabase()) {
    console.log("[v0] Usando datos mock para crear pedido")
    const cliente = mockStore.getClientes().find((c) => c.id === formData.cliente_id)

    const newReserva = mockStore.addReserva({
      numeroPedido: `RES-${new Date().getFullYear()}-${String(mockStore.getReservas().length + 1).padStart(3, "0")}`,
      cliente_id: formData.cliente_id,
      cliente: formData.cliente_nombre || cliente?.nombre || "Cliente",
      empresa: formData.empresa || cliente?.empresa,
      telefono: formData.telefono || cliente?.telefono || "",
      email: formData.email || cliente?.email || "",
      fecha_desde: formData.fecha_entrega,
      fecha_hasta: formData.fecha_devolucion,
      fechaInicio: formData.fecha_entrega,
      fechaFin: formData.fecha_devolucion,
      ubicacion:
        formData.direccion_entrega ||
        `${formData.calle || ""}, ${formData.codigo_postal || ""} ${formData.ciudad || ""}`.trim(),
      calle: formData.calle,
      codigo_postal: formData.codigo_postal,
      ciudad: formData.ciudad,
      estado: formData.estado as any,
      articulos:
        formData.articulos?.map((a) => {
          const articulo = mockStore.getArticulo(a.articulo_id)
          return {
            articulo_id: a.articulo_id,
            nombre: a.nombre || articulo?.nombre || "Artículo",
            cantidad: a.cantidad,
            precio_unitario: a.precio_unitario,
          }
        }) || [],
      total: formData.total || 0,
      notas: formData.notas,
    })

    revalidatePath("/pedidos")
    revalidatePath("/reservas")
    return { success: true, data: newReserva }
  }

  const supabase = createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    const { count } = await supabase.from("pedidos").select("*", { count: "exact", head: true })

    const numeroPedido = `PED-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, "0")}`

    const toInsert = {
      ...formData,
      numero_pedido: numeroPedido,
    }

    const { data, error } = await supabase
      .from("pedidos")
      .insert([toInsert])
      .select()
      .single()

    if (error) throw error

    revalidatePath("/pedidos")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error creando pedido:", error)
    return { success: false, error: "Error al crear pedido" }
  }
}

export async function updatePedido(id: string, formData: any) {
  if (!shouldUseSupabase()) {
    const updated = mockStore.updateReserva(id, formData)
    revalidatePath("/pedidos")
    return { success: true, data: updated }
  }

  const supabase = createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    const { data, error } = await supabase.from("pedidos").update(formData).eq("id", id).select().single()

    if (error) throw error

    revalidatePath("/pedidos")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error actualizando pedido:", error)
    return { success: false, error: "Error al actualizar pedido" }
  }
}

export async function deletePedido(id: string) {
  if (!shouldUseSupabase()) {
    revalidatePath("/pedidos")
    return { success: true }
  }

  const supabase = createServerClient()
  if (!supabase) {
    return { success: false, error: "Supabase no configurado" }
  }

  try {
    const { error } = await supabase.from("pedidos").delete().eq("id", id)

    if (error) throw error

    revalidatePath("/pedidos")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error eliminando pedido:", error)
    return { success: false, error: "Error al eliminar pedido" }
  }
}

export async function getPedidoById(id: string) {
  if (!shouldUseSupabase()) {
    const reserva = mockStore.getReservas().find((r) => r.id === id)
    return { success: true, data: reserva || null }
  }

  const supabase = createServerClient()
  if (!supabase) {
    const reserva = mockStore.getReservas().find((r) => r.id === id)
    return { success: true, data: reserva || null }
  }

  try {
    const { data, error } = await supabase
      .from("pedidos")
      .select(`
        *,
        usuarios:cliente_id (
          nombre,
          email,
          telefono,
          calle,
          ciudad,
          codigo_postal
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("[v0] Error obteniendo pedido de Supabase, buscando en mock:", error)
      const reserva = mockStore.getReservas().find((r) => r.id === id)
      return { success: true, data: reserva || null }
    }

    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error obteniendo pedido, buscando en mock:", error)
    const reserva = mockStore.getReservas().find((r) => r.id === id)
    return { success: true, data: reserva || null }
  }
}
