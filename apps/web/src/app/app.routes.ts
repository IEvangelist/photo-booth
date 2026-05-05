import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/idle/idle.page').then(m => m.IdlePage)
    },
    {
        path: 'phone',
        loadComponent: () => import('./features/number-pad/number-pad.page').then(m => m.NumberPadPage)
    },
    {
        path: 'capture',
        loadComponent: () => import('./features/camera/camera.page').then(m => m.CameraPage)
    },
    {
        path: 'preview',
        loadComponent: () => import('./features/preview/preview.page').then(m => m.PreviewPage)
    },
    {
        path: 'share',
        loadComponent: () => import('./features/share/share.page').then(m => m.SharePage)
    },
    { path: '**', redirectTo: '' }
];
