export interface Options {
    /**
     * An object of option aliases. An alias can be a string or an array of strings. 
     * Aliases let you declare substitute names for an option, e.g., 
     * the short (abbreviated) and long (canonical) variations.
     */
    alias?: { [key: string]: string | string[] };

    /**
     * An array of flags to parse as strings. In the example below, t is parsed as a string, 
     * causing all adjacent characters to be treated as a single value and not as individual options.
     */
    string?: string[];

    /**
     * An array of options to parse as boolean. In the example below, t is parsed as a boolean, 
     * causing the following argument to be treated as an operand.
     */
    boolean?: string[];

    /**
     * An object of default values for options not present in the arguments array.
     */
    default?: { [key: string]: any };

    /**
     * We call this function for each unknown option. Return false to discard the option. 
     * Unknown options are those that appear in the arguments array, 
     * but are not in opts.string, opts.boolean, opts.default, or opts.alias.
     */
    unknown?: (option: string) => any;

    /** 
     * A boolean property. If true, the operands array _ will be populated with all 
     * the arguments after the first operand.
     */
    stopEarly?: boolean;
}

type Result = { [key: string]: boolean | number | string | string[] };

/**
 * Parse command-line arguments. Returns an object mapping argument names to their values.
 * @param argv An array of arguments, usually process.argv.
 * @param options 
 */
export function parse(argv: string[], options?: Options): Result;

export function parseBoolean(value: any): boolean;
export function parseFloat(value: any): number;
export function parseInteger(value: any): number;
export function parseString(value: any): string;
