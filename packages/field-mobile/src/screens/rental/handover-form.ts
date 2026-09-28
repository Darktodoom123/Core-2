export interface HandoverFormInput {
    hourMeter: string;
    fuelLevel: string;
    signeeName: string;
    signatureData?: string;
}

export interface HandoverFormValues {
    hourMeter: number;
    fuelLevelPercent: number;
    signeeName: string;
    signatureBase64: string;
}

export type HandoverFormCheck =
    | { ok: true; values: HandoverFormValues }
    | { ok: false; problems: string[] };

/**
 * Checks the readings and sign-off the operator entered. A handover record
 * holds only what was read off the machine and who really signed: nothing
 * is filled in for the operator.
 */
export function checkHandoverForm(input: HandoverFormInput): HandoverFormCheck {
    const problems: string[] = [];
    const hourText = input.hourMeter.trim();
    const fuelText = input.fuelLevel.trim();
    const hourMeter = Number(hourText);
    const fuelLevelPercent = Number(fuelText);
    const signeeName = input.signeeName.trim();
    const signature = input.signatureData?.trim() ?? '';

    if (hourText === '' || !Number.isFinite(hourMeter) || hourMeter < 0) {
        problems.push('Enter the hour meter reading from the machine.');
    }

    if (
        fuelText === '' ||
        !Number.isInteger(fuelLevelPercent) ||
        fuelLevelPercent < 0 ||
        fuelLevelPercent > 100
    ) {
        problems.push('Enter the fuel level as a whole number from 0 to 100.');
    }

    if (signeeName === '') {
        problems.push("Enter the client representative's name.");
    }

    if (signature === '') {
        problems.push('Capture the client representative’s signature.');
    }

    if (problems.length > 0) {
        return { ok: false, problems };
    }

    return {
        ok: true,
        values: {
            hourMeter,
            fuelLevelPercent,
            signeeName,
            signatureBase64: signature,
        },
    };
}
