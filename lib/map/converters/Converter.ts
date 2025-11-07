'use strict';

export class Converter<T> {

    fromJava(text: string, drawable: T): void {
        // Implementation goes here
    }

    toJava(drawable: T): string | undefined {
        const outputType = (document.getElementById('output-type') as HTMLInputElement)?.value;

        switch (outputType) {
            case "Array":
                return this.toJavaArray(drawable);
            case "List":
                return this.toJavaList(drawable);
            case "Arrays.asList":
                return this.toJavaArraysAsList(drawable);
            case "Raw":
                return this.toRaw(drawable);
        }
    }

    toRaw(drawable: T): string | undefined {
        // Implementation goes here
        return undefined;
    }

    toJavaSingle(drawable: T): string | undefined {
        // Implementation goes here
        return undefined;
    }

    toJavaArray(drawable: T): string | undefined {
        // Implementation goes here
        return undefined;
    }

    toJavaList(drawable: T): string | undefined {
        // Implementation goes here
        return undefined;
    }

    toJavaArraysAsList(drawable: T): string | undefined {
        // Implementation goes here
        return undefined;
    }
}