/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as approvals from "../approvals.js";
import type * as comments from "../comments.js";
import type * as connections from "../connections.js";
import type * as endorsements from "../endorsements.js";
import type * as http from "../http.js";
import type * as humanUsers from "../humanUsers.js";
import type * as invites from "../invites.js";
import type * as lib_emailDomains from "../lib/emailDomains.js";
import type * as lib_utils from "../lib/utils.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as posts from "../posts.js";
import type * as seed from "../seed.js";
import type * as votes from "../votes.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  approvals: typeof approvals;
  comments: typeof comments;
  connections: typeof connections;
  endorsements: typeof endorsements;
  http: typeof http;
  humanUsers: typeof humanUsers;
  invites: typeof invites;
  "lib/emailDomains": typeof lib_emailDomains;
  "lib/utils": typeof lib_utils;
  messages: typeof messages;
  notifications: typeof notifications;
  organizations: typeof organizations;
  posts: typeof posts;
  seed: typeof seed;
  votes: typeof votes;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
