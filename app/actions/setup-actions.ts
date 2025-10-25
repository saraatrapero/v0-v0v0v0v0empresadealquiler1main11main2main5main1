"use server"

import { createClient } from "@supabase/supabase-js"
import { UsuarioSchema, validateOrThrow } from "@/lib/validations/schemas"

export interface SetupResponse {
  success: boolean
  message?: string
  error?: string
}

export async function createAdminUser(email: string, password: string, fullName: string): Promise<SetupResponse> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: "Variables de entorno de Supabase no configuradas" }
    }

    // Validar email y nombre con Zod
    try {
      validateOrThrow(UsuarioSchema, { nombre: fullName, email })
    } catch (validationError: any) {
      return { success: false, error: validationError.message || "Datos inválidos" }
    }

    // Validación mínima de password
    if (!password || password.length < 8) {
      return { success: false, error: "La contraseña debe tener al menos 8 caracteres" }
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if user already exists (sensible a la versión de supabase-js)
    const listResult: any = await supabaseAdmin.auth.admin.listUsers().catch((e) => ({ error: e }))
    if (listResult?.error) {
      console.error("[v0] Error listando usuarios:", listResult.error)
      return { success: false, error: "No se pudo listar usuarios en Supabase" }
    }

    const existingUsers = listResult.data?.users || listResult.users || []
    const userExists = existingUsers.some((u: any) => u.email === email)

    if (userExists) {
      return {
        success: false,
        error: "Este email ya está registrado. Intenta iniciar sesión.",
      }
    }

    // Create user with admin role using service role (bypasses email confirmation)
    const signUpResult: any = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: "admin",
      },
    }).catch((e) => ({ error: e }))

    if (signUpResult?.error) {
      console.error("[v0] Sign up error:", signUpResult.error)
      return {
        success: false,
        error: signUpResult.error.message || "Error al crear usuario admin",
      }
    }

    const authData = signUpResult.data || signUpResult
    if (!authData?.user) {
      return { success: false, error: "No se pudo crear el usuario" }
    }

    // Wait a bit for the trigger to create the profile
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Ensure profile exists with admin role
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: authData.user.id,
        full_name: fullName,
        role: "admin",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    )

    if (profileError) {
      console.error("[v0] Profile error:", profileError)
      // Don't fail if profile creation fails, user is already created
    }

    return {
      success: true,
      message: "Usuario administrador creado exitosamente",
    }
  } catch (error: any) {
    console.error("[v0] Setup error:", error)
    return {
      success: false,
      error: error.message || "Error desconocido al crear el usuario",
    }
  }
}
