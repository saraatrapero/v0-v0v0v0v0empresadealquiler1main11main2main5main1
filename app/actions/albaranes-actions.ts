"use server"

import { createClient } from "@/lib/supabase/server"

export type EstadoAlbaran = "pendiente" | "entregado" | "cancelado"

export interface Cliente {
  id: string
  nombre: string
  email: string
}

export interface Albaran {
  id: string
  numero_albaran: string
  pedido_id: string
  fecha_emision: string
  fecha_entrega: string | null
  estado: EstadoAlbaran
  observaciones: string | null
  firma_cliente: string | null
  cliente: Cliente
}

interface GetAlbaranesResponse {
  success: boolean
  data: Albaran[]
  error?: string
}

export async function getAlbaranes(): Promise<GetAlbaranesResponse> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return {
        success: false,
        data: [],
        error: "Error de configuración: Supabase no está inicializado"
      }
    }

    const { data: albaranesData, error: albaranesError } = await supabase
      .from("albaranes")
      .select("*")
      .order("fecha_emision", { ascending: false })

    if (albaranesError) {
      console.error("[v0] Error al obtener albaranes:", albaranesError)
      throw albaranesError
    }

    if (!albaranesData || albaranesData.length === 0) {
      return { success: true, data: [] }
    }

    // Obtener los pedidos relacionados
    const pedidoIds = albaranesData.map((a) => a.pedido_id).filter(Boolean)

    if (pedidoIds.length === 0) {
      const albaranesSinCliente = albaranesData.map((albaran) => ({
        ...albaran,
        estado: albaran.estado as EstadoAlbaran,
        cliente: {
          id: "",
          nombre: "Sin cliente",
          email: "",
        },
      }))
      return { success: true, data: albaranesSinCliente }
    }

    const { data: pedidosData, error: pedidosError } = await supabase
      .from("pedidos")
      .select("id, cliente_id")
      .in("id", pedidoIds)

    if (pedidosError) {
      console.error("[v0] Error al obtener pedidos:", pedidosError)
      throw pedidosError
    }

    // Obtener los clientes relacionados
    const clienteIds = (pedidosData || []).map((p) => p.cliente_id).filter(Boolean)

    let clientesData: Cliente[] = []
    if (clienteIds.length > 0) {
      const { data, error: clientesError } = await supabase
        .from("usuarios")
        .select("id, nombre, email")
        .in("id", clienteIds)
        .eq("rol", "cliente")

      if (clientesError) {
        console.error("[v0] Error al obtener clientes:", clientesError)
        throw clientesError
      }
      clientesData = data || []
    }

    // Combinar los datos manualmente
    const albaranes: Albaran[] = albaranesData.map((albaran) => {
      const pedido = pedidosData?.find((p) => p.id === albaran.pedido_id)
      const cliente = clientesData.find((c) => c.id === pedido?.cliente_id)

      return {
        id: albaran.id,
        numero_albaran: albaran.numero_albaran,
        pedido_id: albaran.pedido_id,
        fecha_emision: albaran.fecha_emision,
        fecha_entrega: albaran.fecha_entrega,
        estado: albaran.estado as EstadoAlbaran,
        observaciones: albaran.observaciones,
        firma_cliente: albaran.firma_cliente,
        cliente: cliente || {
          id: "",
          nombre: "Cliente desconocido",
          email: "",
        },
      }
    })

    return { success: true, data: albaranes }
  } catch (error) {
    console.error("[v0] Error al obtener albaranes:", error)
    return {
      success: false,
      data: [],
      error: "Error al obtener albaranes. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste."
    }
  }
}

interface UpdateAlbaranFirmaResponse {
  success: boolean
  error?: string
}

export async function updateAlbaranFirma(
  albaranId: string,
  firma: string
): Promise<UpdateAlbaranFirmaResponse> {
  try {
    if (!albaranId?.trim()) {
      return {
        success: false,
        error: "ID de albarán no válido"
      }
    }

    if (!firma?.trim()) {
      return {
        success: false,
        error: "La firma es requerida"
      }
    }

    // Sanitizar y limitar tamaño de la firma (base64 o token)
    const firmaSanitizada = firma.trim()
    if (firmaSanitizada.length > 5000) {
      return { success: false, error: "La firma es demasiado larga" }
    }

    const supabase = await createClient()
    if (!supabase) {
      return {
        success: false,
        error: "Error de configuración: Supabase no está inicializado"
      }
    }

    // Verificar que el albarán existe y está pendiente
    const { data: albaranExistente, error: checkError } = await supabase
      .from("albaranes")
      .select("estado")
      .eq("id", albaranId)
      .maybeSingle()

    if (checkError) {
      throw checkError
    }

    if (!albaranExistente) {
      return {
        success: false,
        error: "Albarán no encontrado"
      }
    }

    if (albaranExistente.estado === "entregado") {
      return {
        success: false,
        error: "El albarán ya ha sido entregado y firmado"
      }
    }

    if (albaranExistente.estado === "cancelado") {
      return {
        success: false,
        error: "No se puede firmar un albarán cancelado"
      }
    }

    const { error: updateError } = await supabase
      .from("albaranes")
      .update({
        firma_cliente: firmaSanitizada,
        estado: "entregado" as EstadoAlbaran,
        fecha_entrega: new Date().toISOString().split("T")[0], // Solo la fecha, no timestamp
      })
      .eq("id", albaranId)

    if (updateError) {
      throw updateError
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error al actualizar firma:", error)
    return {
      success: false,
      error: "Error al actualizar firma. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste."
    }
  }
}
