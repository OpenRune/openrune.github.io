'use strict';

import { Converter } from '../Converter';

export class OSBotConverter extends Converter<any> {
    javaArea: string;
    javaPosition: string;

    constructor() {
        super();
        this.javaArea = "Area";
        this.javaPosition = "Position";
    }
}