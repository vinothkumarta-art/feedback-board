import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  ConfigurationError,
  getEveryAppUser,
  gatewayUrl,
} from "@every-app/sdk/server";

/**
 * The Gateway's origin for a signed-in member: the way back to the other
 * apps, and the host the light/dark cookie is set on. Null for a visitor on
 * a public page, or when the Worker has no GATEWAY_URL.
 */
export const getGatewayUrl = createServerFn().handler(async () => {
  const user = await getEveryAppUser(getRequest(), env);
  if (!user) return { gatewayUrl: null };
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null };
  }
});
