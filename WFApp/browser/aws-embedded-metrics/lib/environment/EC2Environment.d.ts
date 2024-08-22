import { MetricsContext } from '../logger/MetricsContext';
import { ISink } from '../sinks/Sink';
import { IEnvironment } from './IEnvironment';
export declare class EC2Environment implements IEnvironment {
    private metadata;
    private sink;
    probe(): Promise<boolean>;
    getName(): string;
    getType(): string;
    getLogGroupName(): string;
    configureContext(context: MetricsContext): void;
    getSink(): ISink;
}
