/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { IGalleryExtension, AllowedExtensionsConfigKey, IAllowedExtensionsService, AllowedExtensionsConfigValueType } from './extensionManagement.js';
import { ExtensionType, IExtension, TargetPlatform } from '../../extensions/common/extensions.js';
import { IProductService } from '../../product/common/productService.js';
import { createCommandUri, IMarkdownString, MarkdownString } from '../../../base/common/htmlContent.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { isObject } from '../../../base/common/types.js';
import { Emitter } from '../../../base/common/event.js';

function isGalleryExtension(extension: unknown): extension is IGalleryExtension {
	return (extension as IGalleryExtension).type === 'gallery';
}

function isIExtension(extension: unknown): extension is IExtension {
	return (extension as IExtension).type === ExtensionType.User || (extension as IExtension).type === ExtensionType.System;
}


export class AllowedExtensionsService extends Disposable implements IAllowedExtensionsService {

	_serviceBrand: undefined;


	private _allowedExtensionsConfigValue: AllowedExtensionsConfigValueType | undefined;
	get allowedExtensionsConfigValue(): AllowedExtensionsConfigValueType | undefined {
		return this._allowedExtensionsConfigValue;
	}
	private _onDidChangeAllowedExtensions = this._register(new Emitter<void>());
	readonly onDidChangeAllowedExtensionsConfigValue = this._onDidChangeAllowedExtensions.event;

	constructor(
		@IProductService private productService: IProductService,
		@IConfigurationService protected readonly configurationService: IConfigurationService
	) {
		super();

		this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(AllowedExtensionsConfigKey)) {
				this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
				this._onDidChangeAllowedExtensions.fire();
			}
		}));
	}

	private getAllowedExtensionsValue(): AllowedExtensionsConfigValueType | undefined {
		const value = this.configurationService.getValue<AllowedExtensionsConfigValueType | undefined>(AllowedExtensionsConfigKey);
		if (!isObject(value) || Array.isArray(value)) {
			return undefined;
		}
		const entries = Object.entries(value).map(([key, value]) => [key.toLowerCase(), value]);
		if (entries.length === 1 && entries[0][0] === '*' && entries[0][1] === true) {
			return undefined;
		}
		return Object.fromEntries(entries);
	}

	isAllowed(extension: IGalleryExtension | IExtension | { id: string; publisherDisplayName: string | undefined; version?: string; prerelease?: boolean; targetPlatform?: TargetPlatform }): true | IMarkdownString {
		let id: string;
		if (isGalleryExtension(extension)) {
			id = extension.identifier.id.toLowerCase();
		} else if (isIExtension(extension)) {
			id = extension.identifier.id.toLowerCase();
		} else {
			id = extension.id.toLowerCase();
		}
		if (this.productService.allowedExtensions?.includes(id)) {
			return true;
		} else {
			const settingsCommandLink = createCommandUri('workbench.action.openSettings', { query: `@id:${AllowedExtensionsConfigKey}` }).toString();
			const extensionReason = new MarkdownString(nls.localize('specific extension not allowed', "it is not in the [allowed list]({0})", settingsCommandLink));
			return extensionReason;
		}
	}
}
