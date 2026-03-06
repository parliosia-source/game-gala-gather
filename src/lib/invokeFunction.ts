import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke a Supabase Edge Function and properly extract error messages.
 * supabase.functions.invoke returns { data, error } where error is a FunctionsHttpError
 * when status >= 400. The actual error message is in the response body.
 */
export async function invokeFunction(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // Try to extract error message from the response
    let message = error.message || 'Erreur serveur';
    try {
      if (error.context && typeof error.context === 'object' && 'json' in error.context) {
        const json = await (error.context as Response).json();
        if (json?.error) message = json.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  // Check if data itself contains an error (for non-throw cases)
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
