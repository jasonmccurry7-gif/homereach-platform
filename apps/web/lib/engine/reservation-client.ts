import type { Reservation } from "./types";

export class ReservationClientEngine {
  static isExpired(reservation: Reservation): boolean {
    return new Date(reservation.expiresAt).getTime() < Date.now();
  }

  static hoursRemaining(reservation: Reservation): number {
    return Math.max(
      0,
      Math.round((new Date(reservation.expiresAt).getTime() - Date.now()) / 3_600_000)
    );
  }

  static countdownLabel(reservation: Reservation): string {
    const hrs = ReservationClientEngine.hoursRemaining(reservation);
    if (hrs === 0) return "Expired";
    if (hrs < 1) return "< 1 hour remaining";
    return `${hrs}h remaining`;
  }
}

export { ReservationClientEngine as ReservationEngine };
