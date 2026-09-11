import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export interface ApplicationLogoProps extends SVGProps<SVGSVGElement> {
    variant?: 'mark' | 'full' | 'badge';
    badgeClassName?: string;
}

export function ApplicationLogo({
    variant = 'mark',
    className,
    badgeClassName,
    ...props
}: ApplicationLogoProps) {
    if (variant === 'badge') {
        return (
            <div
                className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand p-1.5 text-brand-contrast shadow-sm',
                    badgeClassName,
                )}
            >
                <ApplicationMark
                    className={cn('h-full w-full', className)}
                    {...props}
                />
            </div>
        );
    }

    if (variant === 'full') {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="100 70 300 350"
                fill="none"
                className={cn('h-auto w-full', className)}
                {...props}
            >
                <g fill="currentColor">
                    <path d="M 235 83 L 155 281 L 204 281 L 221 239 C 228 221, 239 204, 250 188 L 235 83 Z" />
                    <path d="M 265 83 L 250 188 C 261 204, 272 221, 279 239 L 296 281 L 345 281 L 265 83 Z" />
                    <polygon points="250,220 228,281 272,281" />
                    <path d="M 120 267 C 175 210, 248 181, 325 183 C 348 184, 357 190, 360 212 C 362 232, 358 249, 355 268 C 353 234, 340 205, 305 201 C 240 193, 178 221, 120 267 Z" />
                </g>
                <g fill="currentColor" textAnchor="middle">
                    <text
                        x="250"
                        y="328"
                        fontFamily="Montserrat, 'Arial Black', sans-serif"
                        fontWeight="900"
                        fontSize="37"
                        letterSpacing="1.5"
                    >
                        ALIBATON
                    </text>
                    <text
                        x="250"
                        y="370"
                        fontFamily="'Montserrat Light', Arial, sans-serif"
                        fontWeight="300"
                        fontSize="20.5"
                        letterSpacing="6.2"
                    >
                        CONSTRUCTION
                    </text>
                    <text
                        x="250"
                        y="403"
                        fontFamily="'Montserrat Light', Arial, sans-serif"
                        fontWeight="300"
                        fontSize="20.5"
                        letterSpacing="6.1"
                    >
                        INCORPORATED
                    </text>
                </g>
            </svg>
        );
    }

    return <ApplicationMark className={className} {...props} />;
}

export function ApplicationMark({
    className,
    ...props
}: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="110 73 260 218"
            fill="none"
            className={cn('h-full w-full', className)}
            {...props}
        >
            <g fill="currentColor">
                <path d="M 235 83 L 155 281 L 204 281 L 221 239 C 228 221, 239 204, 250 188 L 235 83 Z" />
                <path d="M 265 83 L 250 188 C 261 204, 272 221, 279 239 L 296 281 L 345 281 L 265 83 Z" />
                <polygon points="250,220 228,281 272,281" />
                <path d="M 120 267 C 175 210, 248 181, 325 183 C 348 184, 357 190, 360 212 C 362 232, 358 249, 355 268 C 353 234, 340 205, 305 201 C 240 193, 178 221, 120 267 Z" />
            </g>
        </svg>
    );
}
