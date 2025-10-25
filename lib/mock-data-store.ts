// Sistema de datos mock en memoria para la aplicación
// Simula una base de datos local hasta que Supabase esté configurado

export interface Articulo {
  id: string
  codigo: string
  nombre: string
  categoria: string
  descripcion: string
  precio_dia: number
  stock_total: number
  stock_disponible: number
  imagenes: string[]
  coste_compra?: number
  fecha_compra?: string
  proveedor?: string
  amortizacion?: number
  veces_alquilado?: number
}

export interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string
  empresa?: string
  direccion?: string
}

export interface Reserva {
  id: string
  numeroPedido: string
  cliente_id: string
  cliente: string
  empresa?: string
  telefono: string
  email: string
  fecha_desde: string
  fecha_hasta: string
  fechaInicio: string // alias para fecha_desde
  fechaFin: string // alias para fecha_hasta
  ubicacion?: string
  calle?: string
  codigo_postal?: string
  ciudad?: string
  estado: "pendiente" | "confirmado" | "en_servicio" | "completado" | "cancelado"
  articulos: Array<{
    articulo_id: string
    nombre: string
    cantidad: number
    precio_unitario: number
  }>
  total: number
  notas?: string
}

export interface Pedido {
  id: string
  cliente_id: string
  cliente_nombre: string
  fecha_pedido: string
  fecha_entrega: string
  fecha_recogida: string
  estado: "pendiente" | "confirmado" | "en_preparacion" | "entregado" | "completado" | "cancelado"
  articulos: Array<{
    articulo_id: string
    nombre: string
    cantidad: number
    precio_unitario: number
  }>
  subtotal: number
  iva: number
  total: number
}

export interface Factura {
  id: string
  numero: string
  reserva_id?: string
  cliente_id: string
  cliente_nombre: string
  fecha_emision: string
  fecha_vencimiento: string
  estado: "pendiente" | "pagada" | "vencida" | "cancelada"
  articulos: Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    total: number
  }>
  subtotal: number
  iva: number
  total: number
  albaran_id?: string
}

export interface Albaran {
  id: string
  numero: string
  reserva_id?: string
  cliente_id: string
  cliente_nombre: string
  fecha_entrega: string
  estado: "pendiente" | "entregado" | "facturado"
  articulos: Array<{
    descripcion: string
    cantidad: number
  }>
  notas?: string
}

// Store global de datos
class MockDataStore {
  private articulos: Articulo[] = [
    {
      id: "1",
      codigo: "MESA-001",
      nombre: "Mesa Redonda 150cm",
      categoria: "mobiliario",
      descripcion: "Mesa redonda de madera de 150cm de diámetro",
      precio_dia: 45.0,
      stock_total: 10,
      stock_disponible: 8,
      imagenes: ["/mesa-redonda-madera.jpg"],
      coste_compra: 250.0,
      fecha_compra: "2024-01-15",
      proveedor: "Muebles García",
      amortizacion: 450.0,
      veces_alquilado: 10,
    },
    {
      id: "2",
      codigo: "SILLA-001",
      nombre: "Silla Chiavari Dorada",
      categoria: "mobiliario",
      descripcion: "Silla Chiavari dorada para eventos",
      precio_dia: 8.5,
      stock_total: 50,
      stock_disponible: 45,
      imagenes: ["/silla-chiavari-dorada.jpg"],
      coste_compra: 45.0,
      fecha_compra: "2024-02-10",
      proveedor: "Eventos Pro",
      amortizacion: 340.0,
      veces_alquilado: 40,
    },
    {
      id: "3",
      codigo: "FOCO-001",
      nombre: "Foco LED Profesional",
      categoria: "iluminacion",
      descripcion: "Foco LED profesional 200W",
      precio_dia: 35.0,
      stock_total: 15,
      stock_disponible: 12,
      imagenes: ["/foco-led-profesional.jpg"],
      coste_compra: 180.0,
      fecha_compra: "2024-03-05",
      proveedor: "Iluminación Total",
      amortizacion: 280.0,
      veces_alquilado: 8,
    },
  ]

  private clientes: Cliente[] = [
    {
      id: "1",
      nombre: "María García",
      email: "maria@example.com",
      telefono: "666 123 456",
      empresa: "Eventos García",
      direccion: "Calle Mayor 123, Madrid",
    },
    {
      id: "2",
      nombre: "Juan Pérez",
      email: "juan@example.com",
      telefono: "677 234 567",
      empresa: "Bodas Pérez",
      direccion: "Avenida Principal 45, Barcelona",
    },
  ]

  private reservas: Reserva[] = [
    {
      id: "1",
      numeroPedido: "RES-2025-001",
      cliente_id: "1",
      cliente: "María García",
      empresa: "Eventos García",
      telefono: "666 123 456",
      email: "maria@example.com",
      fecha_desde: "2025-01-10",
      fecha_hasta: "2025-01-12",
      fechaInicio: "2025-01-10",
      fechaFin: "2025-01-12",
      ubicacion: "Hotel Marriott, Madrid",
      estado: "confirmado",
      articulos: [
        { articulo_id: "1", nombre: "Mesa Redonda 150cm", cantidad: 5, precio_unitario: 45.0 },
        { articulo_id: "2", nombre: "Silla Chiavari Dorada", cantidad: 20, precio_unitario: 8.5 },
      ],
      total: 395.0,
      notas: "Evento corporativo",
    },
    {
      id: "2",
      numeroPedido: "RES-2025-002",
      cliente_id: "2",
      cliente: "Juan Pérez",
      empresa: "Bodas Pérez",
      telefono: "677 234 567",
      email: "juan@example.com",
      fecha_desde: "2025-01-15",
      fecha_hasta: "2025-01-16",
      fechaInicio: "2025-01-15",
      fechaFin: "2025-01-16",
      ubicacion: "Finca El Olivar, Barcelona",
      estado: "pendiente",
      articulos: [
        { articulo_id: "1", nombre: "Mesa Redonda 150cm", cantidad: 10, precio_unitario: 45.0 },
        { articulo_id: "2", nombre: "Silla Chiavari Dorada", cantidad: 40, precio_unitario: 8.5 },
        { articulo_id: "3", nombre: "Foco LED Profesional", cantidad: 8, precio_unitario: 35.0 },
      ],
      total: 1170.0,
      notas: "Boda - Montaje a las 10:00",
    },
  ]

  private pedidos: Pedido[] = []
  private facturas: Factura[] = []
  private albaranes: Albaran[] = []

  // Métodos para artículos
  getArticulos() {
    return [...this.articulos]
  }

  getArticulo(id: string) {
    return this.articulos.find((a) => a.id === id)
  }

  addArticulo(articulo: Omit<Articulo, "id">) {
    const newArticulo = {
      ...articulo,
      id: Date.now().toString(),
    }
    this.articulos.push(newArticulo)
    return newArticulo
  }

  updateArticulo(id: string, data: Partial<Articulo>) {
    const index = this.articulos.findIndex((a) => a.id === id)
    if (index !== -1) {
      this.articulos[index] = { ...this.articulos[index], ...data }
      return this.articulos[index]
    }
    return null
  }

  deleteArticulo(id: string) {
    const index = this.articulos.findIndex((a) => a.id === id)
    if (index !== -1) {
      this.articulos.splice(index, 1)
      return true
    }
    return false
  }

  // Métodos para clientes
  getClientes() {
    return [...this.clientes]
  }

  addCliente(cliente: Omit<Cliente, "id">) {
    const newCliente = {
      ...cliente,
      id: Date.now().toString(),
    }
    this.clientes.push(newCliente)
    return newCliente
  }

  getCliente(id: string) {
    return this.clientes.find((c) => c.id === id) || null
  }

  updateCliente(id: string, data: Partial<Cliente>) {
    const index = this.clientes.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.clientes[index] = { ...this.clientes[index], ...data }
      return this.clientes[index]
    }
    return null
  }

  deleteCliente(id: string) {
    const index = this.clientes.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.clientes.splice(index, 1)
      return true
    }
    return false
  }

  // Métodos para reservas
  getReservas() {
    return [...this.reservas]
  }

  getReservasConfirmadas() {
    return this.reservas.filter((r) => r.estado === "confirmado")
  }

  addReserva(reserva: Omit<Reserva, "id">) {
    const newReserva = {
      ...reserva,
      id: Date.now().toString(),
    }
    this.reservas.push(newReserva)
    return newReserva
  }

  updateReserva(id: string, data: Partial<Reserva>) {
    const index = this.reservas.findIndex((r) => r.id === id)
    if (index !== -1) {
      this.reservas[index] = { ...this.reservas[index], ...data }
      return this.reservas[index]
    }
    return null
  }

  // Métodos para pedidos
  getPedidos() {
    return [...this.pedidos]
  }

  addPedido(pedido: Omit<Pedido, "id">) {
    const newPedido = {
      ...pedido,
      id: Date.now().toString(),
    }
    this.pedidos.push(newPedido)
    return newPedido
  }

  updatePedido(id: string, data: Partial<any>) {
    const index = this.pedidos.findIndex((p) => p.id === id)
    if (index !== -1) {
      this.pedidos[index] = { ...this.pedidos[index], ...data }
      return this.pedidos[index]
    }
    return null
  }

  // Métodos para facturas
  getFacturas() {
    return [...this.facturas]
  }

  addFactura(factura: Omit<Factura, "id" | "numero">) {
    const numero = `F-${String(this.facturas.length + 1).padStart(4, "0")}`
    const newFactura = {
      ...factura,
      id: Date.now().toString(),
      numero,
    }
    this.facturas.push(newFactura)
    return newFactura
  }

  crearFacturaDesdeReserva(reservaId: string) {
    const reserva = this.reservas.find((r) => r.id === reservaId)
    if (!reserva || reserva.estado !== "confirmado") {
      return null
    }

    const factura = this.addFactura({
      reserva_id: reservaId,
      cliente_id: reserva.cliente_id,
      cliente_nombre: reserva.cliente,
      fecha_emision: new Date().toISOString().split("T")[0],
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      estado: "pendiente",
      articulos: reserva.articulos.map((a) => ({
        descripcion: a.nombre,
        cantidad: a.cantidad,
        precio_unitario: a.precio_unitario,
        total: a.cantidad * a.precio_unitario,
      })),
      subtotal: reserva.total,
      iva: reserva.total * 0.21,
      total: reserva.total * 1.21,
    })

    return factura
  }

  // Métodos para albaranes
  getAlbaranes() {
    return [...this.albaranes]
  }

  addAlbaran(albaran: Omit<Albaran, "id" | "numero">) {
    const numero = `A-${String(this.albaranes.length + 1).padStart(4, "0")}`
    const newAlbaran = {
      ...albaran,
      id: Date.now().toString(),
      numero,
    }
    this.albaranes.push(newAlbaran)
    return newAlbaran
  }

  crearAlbaranDesdeReserva(reservaId: string) {
    const reserva = this.reservas.find((r) => r.id === reservaId)
    if (!reserva || reserva.estado !== "confirmado") {
      return null
    }

    const albaran = this.addAlbaran({
      reserva_id: reservaId,
      cliente_id: reserva.cliente_id,
      cliente_nombre: reserva.cliente,
      fecha_entrega: reserva.fecha_desde,
      estado: "pendiente",
      articulos: reserva.articulos.map((a) => ({
        descripcion: a.nombre,
        cantidad: a.cantidad,
      })),
      notas: reserva.notas,
    })

    return albaran
  }

  convertirAlbaranAFactura(albaranId: string) {
    const albaran = this.albaranes.find((a) => a.id === albaranId)
    if (!albaran || albaran.estado === "facturado") {
      return null
    }

    const reserva = albaran.reserva_id ? this.reservas.find((r) => r.id === albaran.reserva_id) : null

    const subtotal = reserva ? reserva.total : 0
    const factura = this.addFactura({
      albaran_id: albaranId,
      reserva_id: albaran.reserva_id,
      cliente_id: albaran.cliente_id,
      cliente_nombre: albaran.cliente_nombre,
      fecha_emision: new Date().toISOString().split("T")[0],
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      estado: "pendiente",
      articulos: albaran.articulos
        .map((a) => ({
          descripcion: a.descripcion,
          cantidad: a.cantidad,
          precio_unitario: reserva
            ? reserva.articulos.find((ra) => ra.nombre === a.descripcion)?.precio_unitario || 0
            : 0,
          total: 0,
        }))
        .map((a) => ({ ...a, total: a.cantidad * a.precio_unitario })),
      subtotal,
      iva: subtotal * 0.21,
      total: subtotal * 1.21,
    })

    // Marcar albarán como facturado
    const albaranIndex = this.albaranes.findIndex((a) => a.id === albaranId)
    if (albaranIndex !== -1) {
      this.albaranes[albaranIndex].estado = "facturado"
    }

    return factura
  }
}

// Exportar instancia singleton
export const mockStore = new MockDataStore()
export const mockDataStore = mockStore
