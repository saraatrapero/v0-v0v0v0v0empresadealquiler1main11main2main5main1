"use server"

import { createServerClient, shouldUseSupabase } from "@/lib/supabase/server"
import { mockStore } from "@/lib/mock-data-store"
import { revalidatePath } from "next/cache"
import { UsuarioSchema, validateOrThrow } from "@/lib/validations/schemas"

export type TipoCliente = 'particular' | 'empresa' | 'autonomo' | 'asociacion'

export interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string
  empresa?: string
  direccion?: string
  nif_cif?: string
  tipo_cliente: TipoCliente
  notas?: string
  rol: "cliente"
  created_at: string
  updated_at?: string
  ultimo_alquiler?: string
  estado: 'activo' | 'inactivo'
}

export interface ClienteResponse {
  success: boolean
  data: Cliente[] | null
  error?: string
  metadata?: {
    total: number
    filtrados?: number
  }
}

export interface CreateClienteData {
  nombre: string
  email: string
  telefono: string
  direccion: string
  empresa?: string
  nif_cif?: string
  tipo_cliente: TipoCliente
  notas?: string
  estado?: 'activo' | 'inactivo'
}

export interface ClienteFilters {
  search?: string
  tipo?: TipoCliente
  estado?: 'activo' | 'inactivo'
  ordenar?: 'nombre' | 'created_at' | 'ultimo_alquiler'
  orden?: 'asc' | 'desc'
  limite?: number
  pagina?: number
}

export async function getClientes(filters?: ClienteFilters): Promise<ClienteResponse> {
  try {
    if (!shouldUseSupabase()) {
      console.log("[v0] Usando datos mock para clientes")
      let clientes = mockStore.getClientes()

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase().trim()
        clientes = clientes.filter(
          (c) =>
            c.nombre.toLowerCase().includes(searchLower) ||
            c.email.toLowerCase().includes(searchLower) ||
            c.empresa?.toLowerCase().includes(searchLower) ||
            c.nif_cif?.toLowerCase().includes(searchLower)
        )
      }

      if (filters?.estado) {
        clientes = clientes.filter(c => c.estado === filters.estado)
      }

      const total = clientes.length

      // Ordenamiento
      if (filters?.ordenar) {
        clientes.sort((a, b) => {
          const orden = filters.orden === 'desc' ? -1 : 1
          switch (filters.ordenar) {
            case 'nombre':
              return orden * a.nombre.localeCompare(b.nombre)
            case 'created_at':
              return orden * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            case 'ultimo_alquiler':
              if (!a.ultimo_alquiler) return orden
              if (!b.ultimo_alquiler) return -orden
              return orden * (new Date(a.ultimo_alquiler).getTime() - new Date(b.ultimo_alquiler).getTime())
            default:
              return 0
          }
        })
      }

      // Paginación
      if (filters?.limite) {
        const inicio = filters.pagina ? (filters.pagina - 1) * filters.limite : 0
        clientes = clientes.slice(inicio, inicio + filters.limite)
      }

      return { 
        success: true, 
        data: clientes,
        metadata: {
          total,
          filtrados: clientes.length
        }
      }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, data: [], error: "Error de configuración: Supabase no está inicializado" }
    }

    // Construir la consulta base con count
    let query = supabase
      .from("usuarios")
      .select("*", { count: "exact" })
      .eq("rol", "cliente")

    // Aplicar filtros
    if (filters?.search?.trim()) {
      const searchTerm = filters.search.trim()
      query = query.or(
        `nombre.ilike.%${searchTerm}%,` +
        `email.ilike.%${searchTerm}%,` +
        `empresa.ilike.%${searchTerm}%,` +
        `nif_cif.ilike.%${searchTerm}%`
      )
    }

    if (filters?.tipo) {
      query = query.eq("tipo_cliente", filters.tipo)
    }

    if (filters?.estado) {
      query = query.eq("estado", filters.estado)
    }

    // Ordenamiento
    const ordenColumna = filters?.ordenar || "created_at"
    const ordenDireccion = filters?.orden === "asc" ? true : false
    query = query.order(ordenColumna, { ascending: ordenDireccion })

    // Paginación
    if (filters?.limite) {
      const pagina = filters.pagina || 1
      const desde = (pagina - 1) * filters.limite
      query = query.range(desde, desde + filters.limite - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    return { 
      success: true, 
      data: data || [],
      metadata: {
        total: count || 0,
        filtrados: data?.length || 0
      }
    }
  } catch (error) {
    console.error("[v0] Error obteniendo clientes:", error)
    return { 
      success: false, 
      data: [], 
      error: "Error al obtener clientes. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export async function createCliente(formData: CreateClienteData): Promise<{
  success: boolean
  data?: Cliente
  error?: string
}> {
  try {
    // Validación y sanitización básica
    const nombre = formData.nombre?.trim()
    const email = formData.email?.trim().toLowerCase()
    const telefono = formData.telefono?.trim()
    const tipo_cliente = formData.tipo_cliente
    const direccion = formData.direccion?.trim()
    const empresa = formData.empresa?.trim()
    const nif_cif = formData.nif_cif?.trim()
    const notas = formData.notas?.trim()

    // Validación básica de nombre y email con Zod
    try {
      validateOrThrow(UsuarioSchema, { nombre, email })
    } catch (validationError: any) {
      return { success: false, error: validationError.message || "Datos inválidos" }
    }

    // Validaciones obligatorias adicionales
    if (!telefono) {
      return { success: false, error: "El teléfono es requerido" }
    }
    if (!telefono.match(/^\+?[\d\s-]{9,}$/)) {
      return { success: false, error: "El formato del teléfono no es válido" }
    }
    if (!tipo_cliente) {
      return { success: false, error: "El tipo de cliente es requerido" }
    }

    // Validaciones condicionales
    if (tipo_cliente === 'empresa' && !empresa) {
      return { success: false, error: "El nombre de la empresa es requerido para clientes tipo empresa" }
    }
    if (nif_cif && !nif_cif.match(/^[0-9A-Z]{9}$/i)) {
      return { success: false, error: "El formato del NIF/CIF no es válido" }
    }

    const nuevoCliente = {
      nombre,
      email,
      telefono,
      tipo_cliente,
      direccion,
      empresa,
      nif_cif,
      notas,
      estado: 'activo' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (!shouldUseSupabase()) {
      const newCliente = mockStore.addCliente(nuevoCliente)
      revalidatePath("/clientes")
      return { success: true, data: { ...newCliente, rol: "cliente" } as Cliente }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, error: "Error de configuración: Supabase no está inicializado" }
    }

    // Verificar si ya existe un cliente con el mismo email
    const { data: existente, error: checkError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .eq("rol", "cliente")
      .maybeSingle()

    if (checkError) {
      throw checkError
    }

    if (existente) {
      return { success: false, error: "Ya existe un cliente con ese email" }
    }

    // Verificar si ya existe un cliente con el mismo NIF/CIF
    if (nif_cif) {
      const { data: existeNif, error: nifError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("nif_cif", nif_cif)
        .eq("rol", "cliente")
        .maybeSingle()

      if (nifError) {
        throw nifError
      }

      if (existeNif) {
        return { success: false, error: "Ya existe un cliente con ese NIF/CIF" }
      }
    }

    const { data, error } = await supabase
      .from("usuarios")
      .insert([{ ...nuevoCliente, rol: "cliente" }])
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creando cliente:", error)
      if (error.code === "23505") {
        return { success: false, error: "Ya existe un cliente con ese email o NIF/CIF" }
      }
      throw error
    }

    revalidatePath("/clientes")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error creando cliente:", error)
    return { 
      success: false, 
      error: "Error al crear cliente. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export interface UpdateClienteResponse {
  success: boolean
  data?: Cliente
  error?: string
  warnings?: string[]
}

export async function updateCliente(
  id: string,
  formData: Partial<CreateClienteData>
): Promise<UpdateClienteResponse> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "ID de cliente no válido" }
    }

    const warnings: string[] = []
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Sanitizar y validar campos proporcionados
    if (formData.nombre !== undefined) {
      const nombre = formData.nombre.trim()
      if (!nombre) {
        return { success: false, error: "El nombre no puede estar vacío" }
      }
      updateData.nombre = nombre
    }

    if (formData.email !== undefined) {
      const email = formData.email.trim().toLowerCase()
      if (!email) {
        return { success: false, error: "El email no puede estar vacío" }
      }
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return { success: false, error: "El formato del email no es válido" }
      }
      updateData.email = email
    }

    if (formData.telefono !== undefined) {
      const telefono = formData.telefono.trim()
      if (!telefono) {
        return { success: false, error: "El teléfono no puede estar vacío" }
      }
      if (!telefono.match(/^\+?[\d\s-]{9,}$/)) {
        return { success: false, error: "El formato del teléfono no es válido" }
      }
      updateData.telefono = telefono
    }

    if (formData.tipo_cliente !== undefined) {
      if (!formData.tipo_cliente) {
        return { success: false, error: "El tipo de cliente es requerido" }
      }
      updateData.tipo_cliente = formData.tipo_cliente

      // Validar requisitos específicos del tipo de cliente
      if (formData.tipo_cliente === 'empresa' && !formData.empresa?.trim()) {
        warnings.push("Se recomienda especificar el nombre de la empresa para clientes tipo empresa")
      }
    }

    if (formData.nif_cif !== undefined) {
      const nif_cif = formData.nif_cif.trim().toUpperCase()
      if (nif_cif && !nif_cif.match(/^[0-9A-Z]{9}$/)) {
        return { success: false, error: "El formato del NIF/CIF no es válido" }
      }
      updateData.nif_cif = nif_cif || null
    }

    // Sanitizar campos opcionales
    if (formData.direccion !== undefined) {
      updateData.direccion = formData.direccion.trim() || null
    }
    if (formData.empresa !== undefined) {
      updateData.empresa = formData.empresa.trim() || null
    }
    if (formData.notas !== undefined) {
      updateData.notas = formData.notas.trim() || null
    }

    if (!shouldUseSupabase()) {
      const updated = mockStore.updateCliente(id, updateData)
      if (!updated) {
        return { success: false, error: "Cliente no encontrado" }
      }
      revalidatePath("/clientes")
      return { 
        success: true, 
        data: { ...updated, rol: "cliente" } as Cliente,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, error: "Error de configuración: Supabase no está inicializado" }
    }

    // Verificar que el cliente existe
    const { data: existente, error: checkError } = await supabase
      .from("usuarios")
      .select("email, nif_cif")
      .eq("id", id)
      .eq("rol", "cliente")
      .maybeSingle()

    if (checkError) {
      throw checkError
    }

    if (!existente) {
      return { success: false, error: "Cliente no encontrado" }
    }

    // Verificar duplicados de email si se está actualizando
    if (updateData.email && updateData.email !== existente.email) {
      const { data: emailExistente, error: emailError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", updateData.email)
        .neq("id", id)
        .maybeSingle()

      if (emailError) {
        throw emailError
      }

      if (emailExistente) {
        return { success: false, error: "Ya existe otro cliente con ese email" }
      }
    }

    // Verificar duplicados de NIF/CIF si se está actualizando
    if (updateData.nif_cif && updateData.nif_cif !== existente.nif_cif) {
      const { data: nifExistente, error: nifError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("nif_cif", updateData.nif_cif)
        .neq("id", id)
        .maybeSingle()

      if (nifError) {
        throw nifError
      }

      if (nifExistente) {
        return { success: false, error: "Ya existe otro cliente con ese NIF/CIF" }
      }
    }

    // Realizar la actualización
    const { data, error } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id", id)
      .eq("rol", "cliente")
      .select()
      .single()

    if (error) {
      console.error("[v0] Error actualizando cliente:", error)
      if (error.code === "23505") {
        return { success: false, error: "Conflicto de datos únicos (email o NIF/CIF)" }
      }
      throw error
    }

    revalidatePath("/clientes")
    return { 
      success: true, 
      data,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  } catch (error) {
    console.error("[v0] Error actualizando cliente:", error)
    return { 
      success: false, 
      error: "Error al actualizar cliente. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export interface DeleteClienteResponse {
  success: boolean
  error?: string
  metadata?: {
    pedidosPendientes?: number
    pedidosCompletados?: number
    totalFacturacion?: number
    ultimaActividad?: string
  }
}

export async function deleteCliente(
  id: string,
  force?: boolean
): Promise<DeleteClienteResponse> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "ID de cliente no válido" }
    }

    if (!shouldUseSupabase()) {
      // Verificar si el cliente existe
      const cliente = mockStore.getCliente(id)
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" }
      }

      // Obtener pedidos asociados
      const clientePedidos = mockStore.getPedidos().filter((p) => p.cliente_id === id)
      const pedidosPendientes = clientePedidos.filter(p => 
        ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
      ).length
      
      const pedidosCompletados = clientePedidos.filter(p => p.estado === 'completado').length
      const totalFacturacion = clientePedidos.reduce((sum, p) => sum + p.total, 0)

      // No permitir eliminar si hay pedidos pendientes y no se fuerza la eliminación
      if (pedidosPendientes > 0 && !force) {
        return { 
          success: false, 
          error: `No se puede eliminar el cliente porque tiene ${pedidosPendientes} pedidos pendientes`,
          metadata: {
            pedidosPendientes,
            pedidosCompletados,
            totalFacturacion,
            ultimaActividad: clientePedidos.length > 0 
              ? Math.max(...clientePedidos.map(p => new Date(p.fecha_pedido).getTime())).toString()
              : undefined
          }
        }
      }

      const deleted = mockStore.deleteCliente(id)
      if (!deleted) {
        return { success: false, error: "Error al eliminar el cliente" }
      }
      
      revalidatePath("/clientes")
      return { 
        success: true,
        metadata: {
          pedidosCompletados,
          totalFacturacion
        }
      }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, error: "Error de configuración: Supabase no está inicializado" }
    }

    // Verificar que el cliente existe y obtener información básica
    const { data: cliente, error: clienteError } = await supabase
      .from("usuarios")
      .select("id, nombre, email")
      .eq("id", id)
      .eq("rol", "cliente")
      .maybeSingle()

    if (clienteError) {
      throw clienteError
    }

    if (!cliente) {
      return { success: false, error: "Cliente no encontrado" }
    }

    // Obtener información de pedidos
    const { data: pedidos, error: pedidosError } = await supabase
      .from("pedidos")
      .select(`
        id,
        estado,
        fecha_pedido,
        total
      `)
      .eq("cliente_id", id)

    if (pedidosError) {
      throw pedidosError
    }

    if (pedidos && pedidos.length > 0) {
      const pedidosPendientes = pedidos.filter(p => 
        ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
      ).length

      const pedidosCompletados = pedidos.filter(p => p.estado === 'completado').length
      const totalFacturacion = pedidos.reduce((sum, p) => sum + (p.total || 0), 0)
      const fechas = pedidos.map(p => new Date(p.fecha_pedido).getTime())
      const ultimaActividad = fechas.length > 0 ? new Date(Math.max(...fechas)).toISOString() : undefined

      // No permitir eliminar si hay pedidos pendientes y no se fuerza la eliminación
      if (pedidosPendientes > 0 && !force) {
        return {
          success: false,
          error: `No se puede eliminar el cliente porque tiene ${pedidosPendientes} pedidos pendientes`,
          metadata: {
            pedidosPendientes,
            pedidosCompletados,
            totalFacturacion,
            ultimaActividad
          }
        }
      }
    }

    // Si se fuerza la eliminación o no hay pedidos pendientes, proceder
    if (force) {
      // Primero marcar todos los pedidos como cancelados
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ 
          estado: 'cancelado',
          updated_at: new Date().toISOString(),
          notas: `Pedido cancelado automáticamente por eliminación del cliente ${cliente.nombre} (${cliente.email})`
        })
        .eq("cliente_id", id)
        .in("estado", ['pendiente', 'confirmado', 'en_preparacion'])

      if (updateError) {
        throw updateError
      }
    }

    // Proceder con la eliminación
    const { error: deleteError } = await supabase
      .from("usuarios")
      .update({ 
        estado: 'inactivo',
        email: `deleted_${id}_${cliente.email}`, // Preservar el email original pero hacerlo único
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("rol", "cliente")

    if (deleteError) {
      throw deleteError
    }

    revalidatePath("/clientes")
    return { 
      success: true,
      metadata: {
        pedidosCompletados: pedidos?.filter(p => p.estado === 'completado').length || 0,
        totalFacturacion: pedidos?.reduce((sum, p) => sum + (p.total || 0), 0) || 0
      }
    }
  } catch (error) {
    console.error("[v0] Error eliminando cliente:", error)
    return { 
      success: false, 
      error: "Error al eliminar cliente. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export interface ClienteDetails extends Cliente {
  stats?: {
    totalPedidos: number
    pedidosPendientes: number
    pedidosCompletados: number
    totalFacturacion: number
    ultimoPedido?: string
    tiempoPromedioPago?: number
    valoracionPromedio?: number
  }
  historial?: {
    ultimasModificaciones: Array<{
      fecha: string
      campo: string
      valorAnterior?: string
      valorNuevo: string
    }>
    ultimosAlquileres: Array<{
      fecha: string
      articulos: number
      total: number
      estado: EstadoPedido
    }>
  }
}

export interface GetClienteByIdResponse {
  success: boolean
  data?: ClienteDetails | null
  error?: string
}

export async function getClienteById(
  id: string,
  includeStats: boolean = false,
  includeHistorial: boolean = false
): Promise<GetClienteByIdResponse> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "ID de cliente no válido" }
    }

    if (!shouldUseSupabase()) {
      const cliente = mockStore.getCliente(id)
      if (!cliente) {
        return { success: true, data: null }
      }

      // Enriquecer con datos adicionales si se solicitan
      const clienteData: ClienteDetails = { ...cliente, rol: "cliente" } as ClienteDetails

      if (includeStats || includeHistorial) {
        const pedidos = mockStore.getPedidos().filter(p => p.cliente_id === id)
        const pedidosCompletados = pedidos.filter(p => p.estado === 'completado')
        
        if (includeStats) {
          clienteData.stats = {
            totalPedidos: pedidos.length,
            pedidosPendientes: pedidos.filter(p => 
              ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
            ).length,
            pedidosCompletados: pedidosCompletados.length,
            totalFacturacion: pedidos.reduce((sum, p) => sum + p.total, 0),
            ultimoPedido: pedidos.length > 0 ? 
              pedidos.sort((a, b) => new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime())[0].fecha_pedido : 
              undefined,
            tiempoPromedioPago: pedidosCompletados.length > 0 ?
              pedidosCompletados.reduce((sum, p) => 
                sum + (new Date(p.fecha_entrega).getTime() - new Date(p.fecha_pedido).getTime())
              , 0) / pedidosCompletados.length / (1000 * 60 * 60 * 24) : // Convertir a días
              undefined,
          }
        }

        if (includeHistorial) {
          clienteData.historial = {
            ultimasModificaciones: [], // En mock no tenemos historial de modificaciones
            ultimosAlquileres: pedidos
              .sort((a, b) => new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime())
              .slice(0, 5)
              .map(p => ({
                fecha: p.fecha_pedido,
                articulos: p.articulos.length,
                total: p.total,
                estado: p.estado
              }))
          }
        }
      }

      return { success: true, data: clienteData }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, error: "Error de configuración: Supabase no está inicializado" }
    }

    // Construir la consulta base
    const query = supabase
      .from("usuarios")
      .select(`
        *,
        ${includeStats || includeHistorial ? `
        pedidos:pedidos (
          id,
          fecha_pedido,
          fecha_entrega,
          estado,
          total,
          articulos:pedidos_articulos (
            id,
            nombre,
            cantidad
          )
        ),`: ''}
        ${includeHistorial ? `
        historial_cambios:usuarios_historial (
          fecha,
          campo,
          valor_anterior,
          valor_nuevo
        )`: ''}
      `.trim())
      .eq("id", id)
      .eq("rol", "cliente")

    const { data: cliente, error } = await query.maybeSingle()

    if (error) {
      throw error
    }

    if (!cliente) {
      return { success: true, data: null }
    }

    // Enriquecer la respuesta con estadísticas y historial
    const clienteData: ClienteDetails = { ...cliente }

    if (includeStats && cliente.pedidos) {
      const pedidos = cliente.pedidos
      const pedidosCompletados = pedidos.filter(p => p.estado === 'completado')
      
      clienteData.stats = {
        totalPedidos: pedidos.length,
        pedidosPendientes: pedidos.filter(p => 
          ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
        ).length,
        pedidosCompletados: pedidosCompletados.length,
        totalFacturacion: pedidos.reduce((sum, p) => sum + (p.total || 0), 0),
        ultimoPedido: pedidos.length > 0 ? 
          pedidos.sort((a, b) => 
            new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime()
          )[0].fecha_pedido : 
          undefined,
        // Calcular tiempo promedio de pago para pedidos completados
        tiempoPromedioPago: pedidosCompletados.length > 0 ?
          pedidosCompletados.reduce((sum, p) => 
            sum + (new Date(p.fecha_entrega).getTime() - new Date(p.fecha_pedido).getTime())
          , 0) / pedidosCompletados.length / (1000 * 60 * 60 * 24) : // Convertir a días
          undefined,
        valoracionPromedio: undefined // TODO: Implementar sistema de valoraciones
      }
    }

    if (includeHistorial && cliente.historial_cambios) {
      clienteData.historial = {
        ultimasModificaciones: cliente.historial_cambios
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
          .slice(0, 10)
          .map(h => ({
            fecha: h.fecha,
            campo: h.campo,
            valorAnterior: h.valor_anterior,
            valorNuevo: h.valor_nuevo
          })),
        ultimosAlquileres: cliente.pedidos
          ?.sort((a, b) => new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime())
          .slice(0, 5)
          .map(p => ({
            fecha: p.fecha_pedido,
            articulos: p.articulos?.length || 0,
            total: p.total,
            estado: p.estado
          })) || []
      }
    }

    // Limpiar campos internos antes de devolver
    delete clienteData.pedidos
    delete clienteData.historial_cambios

    return { success: true, data: clienteData }
  } catch (error) {
    console.error("[v0] Error obteniendo cliente:", error)
    return { 
      success: false, 
      error: "Error al obtener cliente. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}

export type EstadoPedido = 
  | "pendiente"
  | "confirmado" 
  | "en_preparacion" 
  | "entregado" 
  | "completado" 
  | "cancelado"

export interface ArticuloPedido {
  articulo_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal?: number
  notas?: string
}

export interface Pedido {
  id: string
  cliente_id: string
  fecha_pedido: string
  fecha_entrega: string
  fecha_recogida: string
  estado: EstadoPedido
  articulos: ArticuloPedido[]
  subtotal: number
  iva: number
  total: number
  notas?: string
  created_at: string
  updated_at?: string
  metodo_pago?: string
  direccion_entrega?: string
  contacto_entrega?: string
}

export interface PedidoResponse {
  success: boolean
  data: Pedido[]
  error?: string
  metadata?: {
    total: number
    pendientes: number
    completados: number
  }
}

export interface ClientePedidosFilters {
  estado?: EstadoPedido
  fechaDesde?: string
  fechaHasta?: string
  ordenar?: 'fecha_pedido' | 'fecha_entrega' | 'total'
  orden?: 'asc' | 'desc'
}

export async function getClientePedidos(
  clienteId: string,
  filters?: ClientePedidosFilters
): Promise<PedidoResponse> {
  try {
    if (!clienteId?.trim()) {
      return { success: false, data: [], error: "ID de cliente no válido" }
    }

    if (!shouldUseSupabase()) {
      // Verificar que el cliente existe
      const cliente = mockStore.getCliente(clienteId)
      if (!cliente) {
        return { success: false, data: [], error: "Cliente no encontrado" }
      }

      let pedidos = mockStore.getPedidos().filter((p) => p.cliente_id === clienteId)

      // Aplicar filtros
      if (filters?.estado) {
        pedidos = pedidos.filter(p => p.estado === filters.estado)
      }

      if (filters?.fechaDesde) {
        pedidos = pedidos.filter(p => new Date(p.fecha_pedido) >= new Date(filters.fechaDesde!))
      }

      if (filters?.fechaHasta) {
        pedidos = pedidos.filter(p => new Date(p.fecha_pedido) <= new Date(filters.fechaHasta!))
      }

      // Ordenamiento
      if (filters?.ordenar) {
        pedidos.sort((a, b) => {
          const orden = filters.orden === 'desc' ? -1 : 1
          switch (filters.ordenar) {
            case 'fecha_pedido':
              return orden * (new Date(a.fecha_pedido).getTime() - new Date(b.fecha_pedido).getTime())
            case 'fecha_entrega':
              return orden * (new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime())
            case 'total':
              return orden * (a.total - b.total)
            default:
              return 0
          }
        })
      }

      const pendientes = pedidos.filter(p => 
        ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
      ).length

      const completados = pedidos.filter(p => p.estado === 'completado').length

      return { 
        success: true, 
        data: pedidos,
        metadata: {
          total: pedidos.length,
          pendientes,
          completados
        }
      }
    }

    const supabase = await createServerClient()
    if (!supabase) {
      return { success: false, data: [], error: "Error de configuración: Supabase no está inicializado" }
    }

    // Verificar que el cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("id", clienteId)
      .eq("rol", "cliente")
      .maybeSingle()

    if (clienteError) {
      throw clienteError
    }

    if (!cliente) {
      return { success: false, data: [], error: "Cliente no encontrado" }
    }

    // Construir la consulta base
    let query = supabase
      .from("pedidos")
      .select(`
        *,
        articulos:pedidos_articulos(
          articulo_id,
          nombre,
          cantidad,
          precio_unitario,
          subtotal,
          notas
        )
      `)
      .eq("cliente_id", clienteId)

    // Aplicar filtros
    if (filters?.estado) {
      query = query.eq("estado", filters.estado)
    }

    if (filters?.fechaDesde) {
      query = query.gte("fecha_pedido", filters.fechaDesde)
    }

    if (filters?.fechaHasta) {
      query = query.lte("fecha_pedido", filters.fechaHasta)
    }

    // Ordenamiento
    const ordenColumna = filters?.ordenar || "fecha_pedido"
    const ordenDireccion = filters?.orden === "asc" ? true : false
    query = query.order(ordenColumna, { ascending: ordenDireccion })

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Calcular estadísticas
    const pedidos = data || []
    const pendientes = pedidos.filter(p => 
      ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
    ).length
    const completados = pedidos.filter(p => p.estado === 'completado').length

    return { 
      success: true, 
      data: pedidos,
      metadata: {
        total: pedidos.length,
        pendientes,
        completados
      }
    }
  } catch (error) {
    console.error("[v0] Error obteniendo pedidos del cliente:", error)
    return { 
      success: false, 
      data: [], 
      error: "Error al obtener pedidos. Por favor, inténtalo de nuevo o contacta con soporte si el problema persiste." 
    }
  }
}
