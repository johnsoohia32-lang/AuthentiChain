import { describe, it, expect, beforeEach } from "vitest";
import { bufferCV, stringUtf8CV, uintCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PRODUCT_ID = 101;
const ERR_ORACLE_NOT_REGISTERED = 109;
const ERR_INVALID_CONFIDENCE = 120;
const ERR_INVALID_IPFS_HASH = 122;
const ERR_INVALID_BATCH_SIZE = 124;
const ERR_BATCH_ALREADY_PROCESSED = 125;
const ERR_MAX_ORACLES_EXCEEDED = 115;
const ERR_INVALID_SCORE = 110;
const ERR_INVALID_ORACLE_FEE = 116;
const ERR_EXPIRED_VERIFICATION = 113;
const ERR_INVALID_DETECTION_METHOD = 121;
const ERR_INVALID_VERIFIER_ROLE = 123;

interface Oracle {
  principal: string;
  score: number;
  active: boolean;
  registrationTime: number;
}

interface VerificationResult {
  productId: number;
  isAuthentic: boolean;
  timestamp: number;
  oracleId: number;
  confidence: number;
}

interface ProductMetadata {
  hash: Buffer;
  description: string;
  expiry: number;
  status: boolean;
}

interface BatchVerification {
  productIds: number[];
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VerificationOracleMock {
  state: {
    nextOracleId: number;
    maxOracles: number;
    verificationFee: number;
    adminPrincipal: string;
    oracles: Map<number, Oracle>;
    verificationResults: Map<number, VerificationResult>;
    productMetadata: Map<number, ProductMetadata>;
    oracleFees: Map<number, number>;
    batchVerifications: Map<number, BatchVerification>;
    detectionMethods: Map<number, string>;
    verifierRoles: Map<string, string>;
    ipfsHashes: Map<number, string>;
  } = {
    nextOracleId: 0,
    maxOracles: 50,
    verificationFee: 500,
    adminPrincipal: "ST1TEST",
    oracles: new Map(),
    verificationResults: new Map(),
    productMetadata: new Map(),
    oracleFees: new Map(),
    batchVerifications: new Map(),
    detectionMethods: new Map(),
    verifierRoles: new Map(),
    ipfsHashes: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextOracleId: 0,
      maxOracles: 50,
      verificationFee: 500,
      adminPrincipal: "ST1TEST",
      oracles: new Map(),
      verificationResults: new Map(),
      productMetadata: new Map(),
      oracleFees: new Map(),
      batchVerifications: new Map(),
      detectionMethods: new Map(),
      verifierRoles: new Map(),
      ipfsHashes: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  registerOracle(oraclePrincipal: string, initialScore: number, fee: number): Result<number> {
    if (this.state.nextOracleId >= this.state.maxOracles) return { ok: false, value: ERR_MAX_ORACLES_EXCEEDED };
    if (oraclePrincipal === this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (initialScore < 0 || initialScore > 100) return { ok: false, value: ERR_INVALID_SCORE };
    if (fee < 0) return { ok: false, value: ERR_INVALID_ORACLE_FEE };
    const id = this.state.nextOracleId;
    this.state.oracles.set(id, { principal: oraclePrincipal, score: initialScore, active: true, registrationTime: this.blockHeight });
    this.state.oracleFees.set(id, fee);
    this.state.nextOracleId++;
    return { ok: true, value: id };
  }

  submitVerification(productId: number, isAuthentic: boolean, confidence: number, metadataHash: Buffer, desc: string, ipfsHash: string): Result<boolean> {
    const oracleId = Array.from(this.state.oracles.keys()).find(id => this.state.oracles.get(id)?.principal === this.caller) ?? -1;
    if (oracleId === -1) return { ok: false, value: ERR_ORACLE_NOT_REGISTERED };
    if (productId <= 0) return { ok: false, value: ERR_INVALID_PRODUCT_ID };
    if (confidence < 0 || confidence > 100) return { ok: false, value: ERR_INVALID_CONFIDENCE };
    if (metadataHash.length === 0 || desc.length === 0) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (ipfsHash.length !== 46) return { ok: false, value: ERR_INVALID_IPFS_HASH };
    this.stxTransfers.push({ amount: this.state.verificationFee, from: this.caller, to: "contract" });
    this.state.verificationResults.set(productId, { productId, isAuthentic, timestamp: this.blockHeight, oracleId, confidence });
    this.state.productMetadata.set(productId, { hash: metadataHash, description: desc, expiry: this.blockHeight + 144, status: true });
    this.state.ipfsHashes.set(productId, ipfsHash);
    return { ok: true, value: true };
  }

  batchSubmitVerifications(productIds: number[], authentics: boolean[], confidences: number[]): Result<number> {
    const size = productIds.length;
    if (size > 10) return { ok: false, value: ERR_INVALID_BATCH_SIZE };
    const batchId = this.state.batchVerifications.size;
    if (this.state.batchVerifications.has(batchId)) return { ok: false, value: ERR_BATCH_ALREADY_PROCESSED };
    this.state.batchVerifications.set(batchId, { productIds });
    for (let i = 0; i < size; i++) {
      const result = this.submitVerification(productIds[i], authentics[i], confidences[i], Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
      if (!result.ok) return { ok: false, value: result.value };
    }
    return { ok: true, value: batchId };
  }

  updateOracleScore(oracleId: number, newScore: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newScore < 0 || newScore > 100) return { ok: false, value: ERR_INVALID_SCORE };
    const oracle = this.state.oracles.get(oracleId);
    if (!oracle) return { ok: false, value: ERR_ORACLE_NOT_REGISTERED };
    this.state.oracles.set(oracleId, { ...oracle, score: newScore });
    return { ok: true, value: true };
  }

  deactivateOracle(oracleId: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const oracle = this.state.oracles.get(oracleId);
    if (!oracle) return { ok: false, value: ERR_ORACLE_NOT_REGISTERED };
    this.state.oracles.set(oracleId, { ...oracle, active: false });
    return { ok: true, value: true };
  }

  setVerificationFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_ORACLE_FEE };
    this.state.verificationFee = newFee;
    return { ok: true, value: true };
  }

  registerDetectionMethod(methodId: number, method: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (method.length === 0) return { ok: false, value: ERR_INVALID_DETECTION_METHOD };
    this.state.detectionMethods.set(methodId, method);
    return { ok: true, value: true };
  }

  assignVerifierRole(verifier: string, role: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!["admin", "oracle", "verifier"].includes(role)) return { ok: false, value: ERR_INVALID_VERIFIER_ROLE };
    this.state.verifierRoles.set(verifier, role);
    return { ok: true, value: true };
  }

  verifyExpiry(productId: number): Result<boolean> {
    const meta = this.state.productMetadata.get(productId);
    if (!meta) return { ok: false, value: ERR_INVALID_PRODUCT_ID };
    if (this.blockHeight > meta.expiry) return { ok: false, value: ERR_EXPIRED_VERIFICATION };
    return { ok: true, value: true };
  }

  getAdmin(): Result<string> {
    return { ok: true, value: this.state.adminPrincipal };
  }

  transferAdmin(newAdmin: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.adminPrincipal = newAdmin;
    return { ok: true, value: true };
  }
}

describe("VerificationOracle", () => {
  let contract: VerificationOracleMock;

  beforeEach(() => {
    contract = new VerificationOracleMock();
    contract.reset();
  });

  it("registers an oracle successfully", () => {
    const result = contract.registerOracle("ST2ORACLE", 80, 100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const oracle = contract.state.oracles.get(0);
    expect(oracle?.principal).toBe("ST2ORACLE");
    expect(oracle?.score).toBe(80);
    expect(oracle?.active).toBe(true);
    expect(contract.state.oracleFees.get(0)).toBe(100);
  });

  it("rejects oracle registration when max exceeded", () => {
    contract.state.maxOracles = 0;
    const result = contract.registerOracle("ST2ORACLE", 80, 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_ORACLES_EXCEEDED);
  });

  it("submits verification successfully", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    const result = contract.submitVerification(1, true, 95, Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
    expect(result.ok).toBe(true);
    const ver = contract.state.verificationResults.get(1);
    expect(ver?.isAuthentic).toBe(true);
    expect(ver?.confidence).toBe(95);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST2ORACLE", to: "contract" }]);
  });

  it("rejects submission from unregistered oracle", () => {
    const result = contract.submitVerification(1, true, 95, Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_REGISTERED);
  });

  it("batch submits verifications successfully", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    const result = contract.batchSubmitVerifications([1, 2], [true, false], [95, 80]);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    expect(contract.state.batchVerifications.get(0)?.productIds).toEqual([1, 2]);
    const ver1 = contract.state.verificationResults.get(1);
    expect(ver1?.isAuthentic).toBe(true);
    expect(ver1?.confidence).toBe(95);
    const ver2 = contract.state.verificationResults.get(2);
    expect(ver2?.isAuthentic).toBe(false);
    expect(ver2?.confidence).toBe(80);
  });

  it("rejects batch with invalid size", () => {
    const result = contract.batchSubmitVerifications(Array(11).fill(1), Array(11).fill(true), Array(11).fill(95));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BATCH_SIZE);
  });

  it("updates oracle score successfully", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    const result = contract.updateOracleScore(0, 90);
    expect(result.ok).toBe(true);
    const oracle = contract.state.oracles.get(0);
    expect(oracle?.score).toBe(90);
  });

  it("rejects score update from non-admin", () => {
    contract.caller = "ST3FAKE";
    const result = contract.updateOracleScore(0, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("deactivates oracle successfully", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    const result = contract.deactivateOracle(0);
    expect(result.ok).toBe(true);
    const oracle = contract.state.oracles.get(0);
    expect(oracle?.active).toBe(false);
  });

  it("sets verification fee successfully", () => {
    const result = contract.setVerificationFee(600);
    expect(result.ok).toBe(true);
    expect(contract.state.verificationFee).toBe(600);
  });

  it("registers detection method successfully", () => {
    const result = contract.registerDetectionMethod(1, "AI Scan");
    expect(result.ok).toBe(true);
    expect(contract.state.detectionMethods.get(1)).toBe("AI Scan");
  });

  it("assigns verifier role successfully", () => {
    const result = contract.assignVerifierRole("ST2ORACLE", "oracle");
    expect(result.ok).toBe(true);
    expect(contract.state.verifierRoles.get("ST2ORACLE")).toBe("oracle");
  });

  it("verifies expiry successfully", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    contract.submitVerification(1, true, 95, Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
    const result = contract.verifyExpiry(1);
    expect(result.ok).toBe(true);
  });

  it("rejects expired verification", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    contract.submitVerification(1, true, 95, Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
    contract.blockHeight = 145;
    const result = contract.verifyExpiry(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_EXPIRED_VERIFICATION);
  });

  it("rejects invalid confidence in submission", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    const result = contract.submitVerification(1, true, 101, Buffer.alloc(32), "Product desc", "ipfs-hash-46-chars-long-1234567890123456789012");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CONFIDENCE);
  });

  it("rejects invalid IPFS hash length", () => {
    contract.registerOracle("ST2ORACLE", 80, 100);
    contract.caller = "ST2ORACLE";
    const result = contract.submitVerification(1, true, 95, Buffer.alloc(32), "Product desc", "short");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_IPFS_HASH);
  });
});