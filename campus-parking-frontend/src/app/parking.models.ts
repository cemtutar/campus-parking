export interface ParkingSpot {
  spotId: string;
  status: string;
  lastUpdated: string;
  lotId?: string;
  lat?: number;
  lon?: number;
}

export interface LotSummary {
  lotId: string;
  total: number;
  available: number;
  occupied: number;
  lat?: number;
  lon?: number;
}
