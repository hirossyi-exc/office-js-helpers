/* Copyright (c) Microsoft. All rights reserved. Licensed under the MIT license. */
import { CustomError } from '../errors/custom.error';

/**
 * Constant strings for the host types
 */
export const HostType = {
    WEB: 'WEB',
    ACCESS: 'ACCESS',
    EXCEL: 'EXCEL',
    ONENOTE: 'ONENOTE',
    OUTLOOK: 'OUTLOOK',
    POWERPOINT: 'POWERPOINT',
    PROJECT: 'PROJECT',
    WORD: 'WORD'
};

/**
 * Constant strings for the host platforms
 */
export const PlatformType = {
    IOS: 'IOS',
    MAC: 'MAC',
    OFFICE_ONLINE: 'OFFICE_ONLINE',
    PC: 'PC'
};

/*
* Retrieves host info using a workaround that utilizes the internals of the
* Office.js library. Such workarounds should be avoided, as they can lead to
* a break in behavior, if the internals are ever changed. In this case, however,
* Office.js will soon be delivering a new API to provide the host and platform
* information.
*/
function getHostInfo(): {
    host: 'WEB' | 'ACCESS' | 'EXCEL' | 'ONENOTE' | 'OUTLOOK' | 'POWERPOINT' | 'PROJECT' | 'WORD',
    platform: 'IOS' | 'MAC' | 'OFFICE_ONLINE' | 'PC'
} {
    // A forthcoming API (partially rolled-out) will expose the host and platform info natively
    // when queried from within an add-in.
    // If the platform already exposes that info, then just return it
    // (but only after massaging it to fit the return types expected by this function)

    const hasContext = window['Office'] && window['Office'].context;
    const context = hasContext ? window['Office'].context : {};

    if (context.host && context.platform) {
        return {
            host: convertHostValue(context.host),
            platform: convertPlatformValue(context.platform)
        };
    }

    return useHostInfoFallbackLogic() as any;
};

function useHostInfoFallbackLogic() {
    try {
        if (window.sessionStorage == null) {
            throw new Error(`Session Storage isn't supported`);
        }

        let hostInfoValue = window.sessionStorage['hostInfoValue'] as string;
        let [hostRaw, platformRaw, extras] = hostInfoValue.split('$');

        // Older hosts used "|", so check for that as well:
        if (extras == null) {
            [hostRaw, platformRaw] = hostInfoValue.split('|');
        }

        let host = hostRaw.toUpperCase() || 'WEB';
        let platform: string = null;

        if (Utilities.host !== HostType.WEB) {
            let platforms = {
                'IOS': PlatformType.IOS,
                'MAC': PlatformType.MAC,
                'WEB': PlatformType.OFFICE_ONLINE,
                'WIN32': PlatformType.PC
            };

            platform = platforms[platformRaw.toUpperCase()] || null;
        }

        return { host, platform };
    }
    catch (error) {
        return { host: 'WEB', platform: null };
    }
}

/** Convert the Office.context.host value to one of the Office JS Helpers constants. */
function convertHostValue(host: string) {
    const officeJsToHelperEnumMapping = {
        'Word': HostType.WORD,
        'Excel': HostType.EXCEL,
        'PowerPoint': HostType.POWERPOINT,
        'Outlook': HostType.OUTLOOK,
        'OneNote': HostType.ONENOTE,
        'Project': HostType.PROJECT,
        'Access': HostType.ACCESS
    };

    return officeJsToHelperEnumMapping[host] || null;
}

/** Convert the Office.context.platform value to one of the Office JS Helpers constants. */
function convertPlatformValue(platform: string) {
    const officeJsToHelperEnumMapping = {
        'PC': PlatformType.PC,
        'OfficeOnline': PlatformType.OFFICE_ONLINE,
        'Mac': PlatformType.MAC,
        'iOS': PlatformType.IOS
    };

    return officeJsToHelperEnumMapping[platform] || null;
}

/**
 * Helper exposing useful Utilities for Office-Add-ins.
 */
export class Utilities {
    /*
     * Returns the current host which is either the name of the application where the
     * Office Add-in is running ("EXCEL", "WORD", etc.) or simply "WEB" for all other platforms.
     * The property is always returned in ALL_CAPS.
     * Note that this property is guaranteed to return the correct value ONLY after Office has
     * initialized (i.e., inside, or sequentially after, an Office.initialize = function() { ... }; statement).
     *
     * This code currently uses a workaround that relies on the internals of Office.js.
     * A more robust approach is forthcoming within the official  Office.js library.
     * Once the new approach is released, this implementation will switch to using it
     * instead of the current workaround.
     */
    static get host(): string {
        return getHostInfo().host;
    }

    /*
    * Returns the host application's platform ("IOS", "MAC", "OFFICE_ONLINE", or "PC").
    * This is only valid for Office Add-ins, and hence returns null if the HostType is WEB.
    * The platform is in ALL-CAPS.
    * Note that this property is guaranteed to return the correct value ONLY after Office has
    * initialized (i.e., inside, or sequentially after, an Office.initialize = function() { ... }; statement).
    *
    * This code currently uses a workaround that relies on the internals of Office.js.
    * A more robust approach is forthcoming within the official  Office.js library.
    * Once the new approach is released, this implementation will switch to using it
    * instead of the current workaround.
    */
    static get platform(): string {
        return getHostInfo().platform;
    }

    /**
     * Utility to check if the code is running inside of an add-in.
     */
    static get isAddin() {
        return Utilities.host !== HostType.WEB;
    }

    /**
     * Utility to print prettified errors.
     * If multiple parameters are sent then it just logs them instead.
     */
    static log(exception: Error | CustomError | string, extras?: any, ...args) {
        if (!(extras == null)) {
            return console.log(exception, extras, ...args);
        }
        if (exception == null) {
            console.error(exception);
        }
        else if (typeof exception === 'string') {
            console.error(exception);
        }
        else {
            console.group(`${exception.name}: ${exception.message}`);
            {
                let innerException = exception;
                if (exception instanceof CustomError) {
                    innerException = exception.innerError;
                }
                if ((window as any).OfficeExtension && innerException instanceof OfficeExtension.Error) {
                    console.groupCollapsed('Debug Info');
                    console.error(innerException.debugInfo);
                    console.groupEnd();
                }
                {
                    console.groupCollapsed('Stack Trace');
                    console.error(exception.stack);
                    console.groupEnd();
                }
                {
                    console.groupCollapsed('Inner Error');
                    console.error(innerException);
                    console.groupEnd();
                }
            }
            console.groupEnd();
        }
    }
}
