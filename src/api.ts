import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type Action = "my_assignments" | "start_attempt" | "submit_attempt";

export async function callTestingApi<T>(payload: {
  action: Action;
  [key: string]: unknown;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "service-training-tests-api",
    { body: payload },
  );
  if (error instanceof FunctionsHttpError) {
    try {
      const response = await error.context.clone().json() as { error?: string; message?: string };
      throw new Error(response.error || response.message || error.message);
    } catch (parseError) {
      if (parseError instanceof Error && parseError !== error) throw parseError;
      throw new Error(error.message || "Ошибка сервиса тестирования");
    }
  }
  if (error) throw new Error(error.message || "Сервис тестирования недоступен");
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
