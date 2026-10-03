import { describe, expect, it } from "vitest";
import { computeAge, computeContactStats, computeRevenue, computeTrips } from "@/lib/domain/contact-stats";

describe("computeRevenue — CA total et panier moyen", () => {
  it("panier moyen = CA total / nombre de réservations payées", () => {
    const r = computeRevenue([
      { status: "solde", totalAmount: 4439 },
      { status: "solde", totalAmount: 9249 },
      { status: "confirme", totalAmount: 3614 },
    ]);
    expect(r.revenueTotal).toBe(17302);
    expect(r.bookingCount).toBe(3);
    expect(r.averageBasket).toBeCloseTo(5767.33, 2);
  });

  it("exclut les options et les annulations", () => {
    const r = computeRevenue([
      { status: "solde", totalAmount: 3000 },
      { status: "option", totalAmount: 10544 },
      { status: "annule", totalAmount: 3990 },
    ]);
    expect(r).toEqual({ revenueTotal: 3000, bookingCount: 1, averageBasket: 3000 });
  });

  it("renvoie un panier moyen null sans réservation payée", () => {
    expect(computeRevenue([])).toEqual({ revenueTotal: 0, bookingCount: 0, averageBasket: null });
    expect(computeRevenue([{ status: "option", totalAmount: 1000 }]).averageBasket).toBeNull();
  });

  it("accepte les montants Decimal (chaînes) sans erreur d'arrondi", () => {
    const r = computeRevenue([
      { status: "solde", totalAmount: "1000.10" },
      { status: "solde", totalAmount: "2000.20" },
    ]);
    expect(r.revenueTotal).toBe(3000.3);
    expect(r.averageBasket).toBe(1500.15);
  });

  it("accepte un objet type Prisma.Decimal (toString)", () => {
    const decimal = (v: string) => ({ toString: () => v });
    const r = computeRevenue([{ status: "confirme", totalAmount: decimal("2690.00") }]);
    expect(r.averageBasket).toBe(2690);
  });
});

describe("computeAge", () => {
  const now = new Date("2026-10-03T10:00:00Z");
  it("calcule l'âge révolu", () => {
    expect(computeAge(new Date(Date.UTC(1964, 3, 12)), now)).toBe(62);
  });
  it("ne compte pas l'anniversaire pas encore passé", () => {
    expect(computeAge(new Date(Date.UTC(1966, 9, 4)), now)).toBe(59);
    expect(computeAge(new Date(Date.UTC(1966, 9, 3)), now)).toBe(60);
  });
  it("renvoie null sans date de naissance", () => {
    expect(computeAge(null, now)).toBeNull();
  });
});

describe("computeTrips", () => {
  const now = new Date("2026-10-03T10:00:00Z");
  it("compte les réservations non annulées et trouve le dernier voyage commencé", () => {
    const r = computeTrips(
      [
        { bookingId: "b1", status: "solde", startDate: new Date("2025-03-22"), tripName: "Maroc" },
        { bookingId: "b2", status: "solde", startDate: new Date("2026-07-10"), tripName: "Alpes" },
        { bookingId: "b3", status: "option", startDate: new Date("2027-02-05"), tripName: "Ruta 40" },
        { bookingId: "b4", status: "annule", startDate: new Date("2026-08-01"), tripName: "Ladakh" },
      ],
      now,
    );
    expect(r.tripCount).toBe(3);
    expect(r.lastTrip).toEqual({ tripName: "Alpes", startDate: new Date("2026-07-10") });
  });

  it("n'a pas de dernier voyage si tous sont à venir", () => {
    const r = computeTrips([{ bookingId: "b1", status: "confirme", startDate: new Date("2027-01-01"), tripName: "X" }], now);
    expect(r).toEqual({ tripCount: 1, lastTrip: null });
  });
});

describe("computeContactStats", () => {
  it("assemble tous les champs calculés", () => {
    const lastContactAt = new Date("2026-09-28T14:35:00Z");
    const stats = computeContactStats({
      birthDate: new Date(Date.UTC(1964, 3, 12)),
      paidBookings: [{ status: "solde", totalAmount: 4000 }, { status: "solde", totalAmount: 2000 }],
      participations: [{ bookingId: "b1", status: "solde", startDate: new Date("2025-03-22"), tripName: "Maroc" }],
      lastContactAt,
      now: new Date("2026-10-03T10:00:00Z"),
    });
    expect(stats).toMatchObject({ age: 62, revenueTotal: 6000, bookingCount: 2, averageBasket: 3000, tripCount: 1, lastContactAt });
  });
});
