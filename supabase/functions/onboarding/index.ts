// Supabase Edge Function: onboarding
// Executed in Supabase Deno runtime with Service Role privileges
// Validates caller authentication, creates the first condominium, associates profile as admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OnboardingRequestBody {
  name: string;
  document?: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  total_units?: number;
  manager_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta (service role)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validar Token de Autenticação do Usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autorização não fornecido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado ou sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verificar se o usuário já possui condomínio associado
    const { data: existingProfile, error: profileFetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, condominium_id, is_active")
      .eq("id", user.id)
      .single();

    if (profileFetchError && profileFetchError.code !== "PGRST116") {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar perfil do usuário." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingProfile?.condominium_id) {
      return new Response(
        JSON.stringify({ error: "Este usuário já está vinculado a um condomínio existente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar Dados de Entrada
    const body: OnboardingRequestBody = await req.json();
    if (!body.name?.trim() || !body.address?.trim() || !body.city?.trim() || !body.state?.trim()) {
      return new Response(
        JSON.stringify({ error: "Nome do condomínio, endereço, cidade e estado são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Criar o Condomínio
    const { data: newCondominium, error: condoInsertError } = await supabaseAdmin
      .from("condominiums")
      .insert({
        name: body.name.trim(),
        document: body.document?.trim() || null,
        address: body.address.trim(),
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
        zip_code: body.zip_code?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || user.email || null,
        total_units: Number(body.total_units) || 1,
      })
      .select()
      .single();

    if (condoInsertError || !newCondominium) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar condomínio: ${condoInsertError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Atualizar ou Criar Perfil do Usuário como ADMIN do Condomínio
    const profileData = {
      id: user.id,
      condominium_id: newCondominium.id,
      full_name: body.manager_name?.trim() || existingProfile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Administrador",
      email: user.email!,
      role: "admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData)
      .select()
      .single();

    if (profileUpdateError || !updatedProfile) {
      return new Response(
        JSON.stringify({ error: `Erro ao associar perfil administrativo: ${profileUpdateError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Registrar Auditoria Inicial (Activity Log)
    await supabaseAdmin.from("activity_logs").insert({
      condominium_id: newCondominium.id,
      user_id: user.id,
      action: "CREATE",
      entity_type: "condominium",
      entity_id: newCondominium.id,
      description: `Onboarding inicial: condomínio '${newCondominium.name}' configurado pelo administrador inicial.`,
      metadata: { initial_admin_id: user.id, initial_admin_email: user.email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        condominium: newCondominium,
        profile: updatedProfile,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Erro interno durante onboarding." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
