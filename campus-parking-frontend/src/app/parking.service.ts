import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ParkingSpot } from './parking.models';

@Injectable({
  providedIn: 'root',
})
export class ParkingService {
  private readonly baseUrl = API_BASE_URL.replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  getSpots(): Observable<ParkingSpot[]> {
    return this.http.get<ParkingSpot[]>(`${this.baseUrl}/spots/list`);
  }

  registerSpot(
    spotId: string,
    lotId?: string,
    lat?: number | null,
    lon?: number | null,
  ): Observable<ParkingSpot> {
    const body: any = { spotId };
    if (lotId) {
      body.lotId = lotId;
    }
    if (lat != null) {
      body.lat = lat;
    }
    if (lon != null) {
      body.lon = lon;
    }
    return this.http.post<ParkingSpot>(`${this.baseUrl}/spots/register`, body);
  }

  occupySpot(spotId: string): Observable<ParkingSpot> {
    return this.http.post<ParkingSpot>(`${this.baseUrl}/spots/occupy`, {
      spotId,
    });
  }

  releaseSpot(spotId: string): Observable<ParkingSpot> {
    return this.http.post<ParkingSpot>(`${this.baseUrl}/spots/release`, {
      spotId,
    });
  }

  deleteSpot(spotId: string): Observable<ParkingSpot> {
    return this.http.request<ParkingSpot>('delete', `${this.baseUrl}/spots/delete`, {
      body: { spotId },
    });
  }
}
