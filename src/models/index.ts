import Domain, { IDomain, PoolType, MailboxType } from "./Domain";
import User, {
  IUser,
  IApiKey,
  ISubscription,
  IPoolSettings,
  IPoolConfig,
  IRotationRules,
  IAutomationTriggers,
} from "./User";
import Pool, { IPool } from "./Pool";

export {
  // Models
  Domain,
  User,
  Pool,

  // Types
  type IDomain,
  type IUser,
  type IApiKey,
  type ISubscription,
  type IPoolSettings,
  type IPoolConfig,
  type IRotationRules,
  type IAutomationTriggers,
  type IPool,
  type PoolType,
  type MailboxType,
};
