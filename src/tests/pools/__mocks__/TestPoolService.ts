import { LoggerService } from "../../../services/logging/LoggerService";
import { PoolType } from "../../../models/Domain";
import { MockEmailGuardService, MockSmartleadService } from "./mockServices";
import { PoolSettings } from "../../../services/pools/types";

export class TestPoolService {
  private readonly logger: LoggerService;

  constructor(
    private readonly emailGuardService: MockEmailGuardService,
    private readonly smartleadService: MockSmartleadService
  ) {
    this.logger = new LoggerService("TestPoolService");
  }

  async assignDomainToPool(
    domainId: string,
    targetPool: PoolType,
    currentPool: PoolType
  ): Promise<void> {
    // Validate pool transitions
    if (targetPool === "Active" && currentPool !== "ReadyWaiting") {
      throw new Error(
        "Domains can only be assigned to Active pool from ReadyWaiting"
      );
    }

    if (targetPool === "Recovery" && currentPool !== "Active") {
      throw new Error(
        "Only domains from Active pool can be assigned to Recovery"
      );
    }

    if (!currentPool && targetPool !== "InitialWarming") {
      throw new Error("New domains must start in InitialWarming pool");
    }

    await this.logger.info("Domain assigned to pool", {
      domainId,
      targetPool,
      currentPool,
    });
  }

  async processDomainRecovery(
    domainId: string,
    daysInRecovery: number,
    averageScore: number
  ): Promise<{ shouldTransition: boolean; reason: string }> {
    const requiredDays = 21;
    const requiredScore = 75;

    if (daysInRecovery < requiredDays) {
      return {
        shouldTransition: false,
        reason: `Domain needs ${
          requiredDays - daysInRecovery
        } more days in Recovery`,
      };
    }

    if (averageScore >= requiredScore) {
      return {
        shouldTransition: true,
        reason: "Met recovery criteria",
      };
    }

    return {
      shouldTransition: false,
      reason: "Test scores still below recovery threshold",
    };
  }

  async validateSettings(
    settings: PoolSettings,
    poolType: PoolType
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate based on pool type
    switch (poolType) {
      case "InitialWarming":
      case "ReadyWaiting":
      case "Recovery":
        if (settings.sending.dailyLimit > 1) {
          errors.push("Daily limit exceeds maximum allowed (1)");
        }
        if (settings.sending.minTimeGap < 600) {
          errors.push("Time gap below minimum required (600)");
        }
        break;

      case "Active":
        if (settings.sending.dailyLimit > 20) {
          errors.push("Daily limit exceeds maximum allowed (20)");
        }
        if (settings.sending.minTimeGap < 15) {
          errors.push("Time gap below minimum required (15)");
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
