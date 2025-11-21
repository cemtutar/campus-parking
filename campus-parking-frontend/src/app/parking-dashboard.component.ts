import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ParkingService } from './parking.service';
import { LotSummary, ParkingSpot } from './parking.models';

@Component({
  selector: 'app-parking-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parking-dashboard.component.html',
  styleUrl: './parking-dashboard.component.css',
})
export class ParkingDashboardComponent implements OnInit, AfterViewInit {
  spots: ParkingSpot[] = [];
  filteredSpots: ParkingSpot[] = [];
  lotSummaries: LotSummary[] = [];
  lotMarkers: Array<LotSummary & { lat: number; lon: number }> = [];
  mapImageFailed = false;
  mapBounds = { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
  map: L.Map | null = null;
  markerLayer: L.LayerGroup | null = null;
  placementLayer: L.CircleMarker | null = null;
  @ViewChild('leafletMap') mapContainer?: ElementRef<HTMLDivElement>;
  suggestedSpotNumber: string | null = null;
  loading = false;
  error: string | null = null;

  newSpotId = '';
  newLotId = '';
  newLat: number | null = null;
  newLon: number | null = null;

  filterLotId = '';
  filterStatus: 'ALL' | 'AVAILABLE' | 'OCCUPIED' = 'ALL';

  constructor(private parkingService: ParkingService) {}

  ngOnInit(): void {
    this.refreshSpots();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  refreshSpots(): void {
    this.loading = true;
    this.error = null;
    this.parkingService.getSpots().subscribe({
      next: (spots) => {
        this.spots = spots;
        this.rebuildLotSummaries();
        this.applyFilters();
        this.updateSuggestedSpotId();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load parking spots.';
        this.loading = false;
      },
    });
  }

  registerSpot(): void {
    const lotIdRaw = this.newLotId.trim();
    const spotNumberRaw = this.newSpotId.trim();

    if (!lotIdRaw) {
      this.error = 'Lot ID is required.';
      return;
    }

    if (!spotNumberRaw) {
      this.error = 'Spot number is required.';
      return;
    }

    const numberPattern = /^\d{2,3}$/;
    if (!numberPattern.test(spotNumberRaw)) {
      this.error =
        'Spot number must be 2–3 digits, e.g. 01, 12, 105.';
      return;
    }

    const lotIdNormalized = this.normalizeLotForId(lotIdRaw);
    const spotNumberPadded = spotNumberRaw.padStart(3, '0');
    const finalSpotId = `${lotIdNormalized}-${spotNumberPadded}`;

    this.error = null;
    this.parkingService
      .registerSpot(
        finalSpotId,
        lotIdRaw || undefined,
        this.newLat,
        this.newLon,
      )
      .subscribe({
        next: () => {
          this.newSpotId = '';
          this.newLotId = '';
          this.newLat = null;
          this.newLon = null;
          this.suggestedSpotNumber = null;
          this.refreshSpots();
        },
        error: () => {
          this.error = 'Failed to register spot.';
        },
      });
  }

  onLotChange(): void {
    this.updateSuggestedSpotId();
  }

  useSuggestedSpotId(): void {
    if (this.suggestedSpotNumber) {
      this.newSpotId = this.suggestedSpotNumber;
    }
  }

  occupySpot(spot: ParkingSpot): void {
    this.error = null;
    this.parkingService.occupySpot(spot.spotId).subscribe({
      next: (updated) => {
        this.updateSpotInList(updated);
      },
      error: () => {
        this.error = `Failed to mark spot ${spot.spotId} as occupied.`;
      },
    });
  }

  releaseSpot(spot: ParkingSpot): void {
    this.error = null;
    this.parkingService.releaseSpot(spot.spotId).subscribe({
      next: (updated) => {
        this.updateSpotInList(updated);
      },
      error: () => {
        this.error = `Failed to mark spot ${spot.spotId} as available.`;
      },
    });
  }

  deleteSpot(spot: ParkingSpot): void {
    if (!confirm(`Delete spot ${spot.spotId}?`)) {
      return;
    }

    this.error = null;
    this.parkingService.deleteSpot(spot.spotId).subscribe({
      next: () => {
        this.spots = this.spots.filter((s) => s.spotId !== spot.spotId);
        this.rebuildLotSummaries();
        this.applyFilters();
        this.updateSuggestedSpotId();
      },
      error: () => {
        this.error = `Failed to delete spot ${spot.spotId}.`;
      },
    });
  }

  private updateSpotInList(updated: ParkingSpot): void {
    this.spots = this.spots.map((s) =>
      s.spotId === updated.spotId ? updated : s,
    );
    this.rebuildLotSummaries();
    this.applyFilters();
  }

  applyFilters(): void {
    const lotFilter = this.filterLotId.trim().toLowerCase();
    const statusFilter = this.filterStatus;

    this.filteredSpots = this.spots.filter((spot) => {
      const matchesLot =
        !lotFilter ||
        (spot.lotId || '').toLowerCase().includes(lotFilter);
      const matchesStatus =
        statusFilter === 'ALL' || spot.status === statusFilter;
      return matchesLot && matchesStatus;
    });
  }

  rebuildLotSummaries(): void {
    const map = new Map<string, LotSummary>();
    const locations = new Map<
      string,
      { latSum: number; lonSum: number; count: number }
    >();

    for (const spot of this.spots) {
      const lotId = spot.lotId && spot.lotId.trim() ? spot.lotId : 'Unassigned';
      let summary = map.get(lotId);
      if (!summary) {
        summary = { lotId, total: 0, available: 0, occupied: 0 };
        map.set(lotId, summary);
      }
      summary.total += 1;
      if (spot.status === 'AVAILABLE') {
        summary.available += 1;
      } else if (spot.status === 'OCCUPIED') {
        summary.occupied += 1;
      }

      if (spot.lat != null && spot.lon != null) {
        const exists = locations.get(lotId) || {
          latSum: 0,
          lonSum: 0,
          count: 0,
        };
        exists.latSum += spot.lat;
        exists.lonSum += spot.lon;
        exists.count += 1;
        locations.set(lotId, exists);
      }
    }

    const summaries = Array.from(map.values()).map((summary) => {
      const loc = locations.get(summary.lotId);
      if (loc && loc.count > 0) {
        return {
          ...summary,
          lat: loc.latSum / loc.count,
          lon: loc.lonSum / loc.count,
        };
      }
      return summary;
    });

    this.lotSummaries = summaries.sort((a, b) =>
      a.lotId.localeCompare(b.lotId),
    );
    this.rebuildMapMarkers();
    this.renderMarkers();
  }

  private rebuildMapMarkers(): void {
    const located = this.lotSummaries.filter(
      (s): s is LotSummary & { lat: number; lon: number } =>
        s.lat != null && s.lon != null,
    );

    if (!located.length) {
      this.mapBounds = { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
      this.lotMarkers = [];
      return;
    }

    const lats = located.map((s) => s.lat);
    const lons = located.map((s) => s.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latSpan = maxLat - minLat || 1;
    const lonSpan = maxLon - minLon || 1;
    this.mapBounds = { minLat, maxLat, minLon, maxLon };

    this.lotMarkers = located.map((summary) => ({
      ...summary,
      lat: summary.lat,
      lon: summary.lon,
    }));
  }

  selectLotFilter(lotId: string): void {
    this.filterLotId = lotId === 'Unassigned' ? '' : lotId;
    this.applyFilters();
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) {
      return;
    }
    const campusCenter: L.LatLngExpression = [28.0623, -82.4134]; // 28°03'44.3"N 82°24'48.2"W
    const campusZoom = 16;
    this.map = L.map(this.mapContainer.nativeElement, {
      center: campusCenter,
      zoom: campusZoom,
      minZoom: 2,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));
  }

  private renderMarkers(): void {
    if (!this.map || !this.markerLayer) {
      return;
    }
    this.markerLayer.clearLayers();

    for (const lot of this.lotSummaries) {
      if (lot.lat == null || lot.lon == null) {
        continue;
      }
      const latlng: L.LatLngExpression = [lot.lat, lot.lon];

      const fill =
        lot.available === 0
          ? '#ef4444'
          : lot.available <= 3
            ? '#f59e0b'
            : '#22c55e';

      const marker = L.circleMarker(latlng, {
        radius: 12,
        color: '#0f172a',
        weight: 2,
        fillColor: fill,
        fillOpacity: 0.9,
      });

      marker.bindPopup(
        `<div style="font-weight:700;margin-bottom:4px">${lot.lotId}</div><div>${lot.available} free / ${lot.total} total</div>`,
      );
      marker.on('click', () => this.selectLotFilter(lot.lotId));
      marker.addTo(this.markerLayer);
    }

    if (this.placementLayer && this.placementLayer.getLatLng()) {
      this.placementLayer.addTo(this.markerLayer);
    }

    const markerLatLngs = this.markerLayer.getLayers().map((l) =>
      (l as L.Marker).getLatLng(),
    );
    if (markerLatLngs.length) {
      this.map.fitBounds(L.latLngBounds(markerLatLngs), { padding: [20, 20] });
    }
  }

  private onMapClick(event: L.LeafletMouseEvent): void {
    this.newLat = parseFloat(event.latlng.lat.toFixed(6));
    this.newLon = parseFloat(event.latlng.lng.toFixed(6));
    this.updateSuggestedSpotId();

    if (this.placementLayer) {
      this.placementLayer.setLatLng(event.latlng);
    } else if (this.map) {
      this.placementLayer = L.circleMarker(event.latlng, {
        radius: 10,
        color: '#0369a1',
        weight: 2,
        fillColor: '#0ea5e9',
        fillOpacity: 0.8,
      }).addTo(this.markerLayer ?? this.map);
    }
  }

  updateSuggestedSpotId(): void {
    const lotId = this.newLotId.trim();
    if (!lotId) {
      this.suggestedSpotNumber = null;
      return;
    }
    const base = this.normalizeLotForId(lotId);
    if (!base) {
      this.suggestedSpotNumber = null;
      return;
    }
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}-(\\d{2,})$`, 'i');
    const candidates = this.spots
      .filter((s) => s.lotId && s.spotId && pattern.test(s.spotId))
      .map((s) => {
        const match = s.spotId.match(pattern);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextNum = (candidates.length ? Math.max(...candidates) + 1 : 1)
      .toString()
      .padStart(3, '0');
    this.suggestedSpotNumber = nextNum;
  }

  get suggestedSpotFullId(): string | null {
    if (!this.suggestedSpotNumber) {
      return null;
    }
    const base = this.normalizeLotForId(this.newLotId);
    return base ? `${base}-${this.suggestedSpotNumber}` : null;
  }

  private normalizeLotForId(lotId: string): string {
    return lotId.trim().replace(/\s+/g, '-');
  }
}
