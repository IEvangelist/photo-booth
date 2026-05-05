import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
    BoothOptionsDto,
    CaptureStatusDto,
    CreateCaptureRequest,
    CreateCaptureResponse
} from './booth-api.types';

@Injectable({ providedIn: 'root' })
export class BoothApiService {
    private readonly http = inject(HttpClient);
    private readonly base = environment.apiBaseUrl;

    getOptions(): Observable<BoothOptionsDto> {
        return this.http.get<BoothOptionsDto>(`${this.base}/api/options`);
    }

    createCapture(request: CreateCaptureRequest): Observable<CreateCaptureResponse> {
        return this.http.post<CreateCaptureResponse>(`${this.base}/api/captures`, request);
    }

    getStatus(captureId: string): Observable<CaptureStatusDto> {
        return this.http.get<CaptureStatusDto>(`${this.base}/api/captures/${captureId}/status`);
    }
}
