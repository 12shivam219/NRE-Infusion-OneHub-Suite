import { Request, Response, NextFunction } from 'express';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            apiVersion: number;
        }
    }
}

export interface APIVersion {
    version: number;
    deprecated?: boolean;
    sunset?: Date;
}

export class APIVersionManager {
    private static readonly SUPPORTED_VERSIONS: APIVersion[] = [
        { version: 1 },
        { version: 2 },
        { 
            version: 3, 
            deprecated: true, 
            sunset: new Date('2026-01-01') 
        }
    ];

    private static readonly CURRENT_VERSION = 2;
    private static readonly MIN_SUPPORTED_VERSION = 1;

    static middleware(req: Request, res: Response, next: NextFunction) {
        const requestedVersion = this.extractVersion(req);
        
        // Set default version if none specified
        if (!requestedVersion) {
            req.apiVersion = this.CURRENT_VERSION;
            return next();
        }

        // Check if version is supported
        const versionInfo = this.SUPPORTED_VERSIONS.find(v => v.version === requestedVersion);
        if (!versionInfo) {
            return res.status(400).json({
                error: 'Unsupported API version',
                supportedVersions: this.SUPPORTED_VERSIONS
                    .filter(v => !v.deprecated)
                    .map(v => v.version)
            });
        }

        // Check if version is deprecated
        if (versionInfo.deprecated) {
            res.set('Warning', `299 - "This API version is deprecated"`);
            if (versionInfo.sunset) {
                res.set('Sunset', versionInfo.sunset.toISOString());
            }
        }

        req.apiVersion = requestedVersion;
        next();
    }

    private static extractVersion(req: Request): number | null {
        // Try from URL path (/v2/endpoint)
        const urlMatch = req.path.match(/^\/v(\d+)\//);
        if (urlMatch) {
            return parseInt(urlMatch[1]);
        }

        // Try from Accept header (application/vnd.app.v2+json)
        const acceptHeader = req.get('Accept');
        if (acceptHeader) {
            const versionMatch = acceptHeader.match(/application\/vnd\.app\.v(\d+)\+json/);
            if (versionMatch) {
                return parseInt(versionMatch[1]);
            }
        }

        // Try from custom header (X-API-Version: 2)
        const versionHeader = req.get('X-API-Version');
        if (versionHeader) {
            return parseInt(versionHeader);
        }

        return null;
    }

    static getVersionInfo(version: number): APIVersion | null {
        return this.SUPPORTED_VERSIONS.find(v => v.version === version) || null;
    }

    static isVersionSupported(version: number): boolean {
        return version >= this.MIN_SUPPORTED_VERSION && 
               version <= this.CURRENT_VERSION;
    }
}