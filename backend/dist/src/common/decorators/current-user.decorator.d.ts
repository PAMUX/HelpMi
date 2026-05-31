export interface JwtPayload {
    id: string;
    phone: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
