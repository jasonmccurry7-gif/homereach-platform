import type { Metadata } from "next";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine } from "@/lib/engine/reservation";
import { AvailabilityClient } from "./availability-client";

export const metadata: Metadata = { title: "Availability — HomeReach Admin" };

export default async function AdminAvailabilityPage() {
  const availabilityEngine  = new AvailabilityEngine();
  const reservationEngine   = new ReservationEngine();

  const [cities, reservations] = await Promise.all([
    availabilityEngine.getAllCities(),
    reservationEngine.getAllActive(),
  ]);

  return <AvailabilityClient cities={cities} reservations={reservations} />;
}
