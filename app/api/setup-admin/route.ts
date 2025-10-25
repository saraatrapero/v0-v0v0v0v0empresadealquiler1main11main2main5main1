import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Safety: only allow automated setup in non-production or when explicitly enabled
    const allowSetup = process.env.ALLOW_SETUP === "true"
    if (process.env.NODE_ENV === "production" && !allowSetup) {
      return NextResponse.json({ success: false, error: "Setup deshabilitado en producción" }, { status: 403 })
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Supabase no configurado correctamente" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { error: tableCheckError } = await supabase.from("profiles").select("id").limit(1)

    if (tableCheckError && tableCheckError.code === "42P01") {
      // Table doesn't exist, create it
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          username TEXT,
          role TEXT DEFAULT 'user',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Users can view own profile"
          ON profiles FOR SELECT USING (auth.uid() = id);
        
        CREATE POLICY IF NOT EXISTS "Users can update own profile"
          ON profiles FOR UPDATE USING (auth.uid() = id);
        
        CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users"
          ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
      `

      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })
      if (createError) {
        console.log("[v0] Note: Could not auto-create table, it may already exist")
      }
    }

    const email = "admin@empresa.com"
    const password = "admin123"

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find((u) => u.email === email)

    let userId: string

    if (existingUser) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      })

      if (updateError) throw updateError
      userId = existingUser.id
    } else {
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: "Administrador",
          username: "admin",
          role: "admin",
        },
      })

      if (createError) throw createError
      if (!userData.user) throw new Error("No se pudo crear el usuario")

      userId = userData.user.id
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: email,
        full_name: "Administrador",
        username: "admin",
        role: "admin",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    )

    if (profileError) {
      console.error("[v0] Error en perfil:", profileError)
      // Don't throw, profile might be created by trigger
    }

    return NextResponse.json({
      success: true,
      message: "✅ Usuario administrador creado correctamente. Ahora puedes iniciar sesión.",
      credentials: {
        email,
        password,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error desconocido",
        details: error.hint || error.details || "Sin detalles adicionales",
      },
      { status: 500 },
    )
  }
}
