import type { AssetPathResolver } from "@Core/AssetPathResolver";
import type { CommandlineUtility } from "@Core/CommandlineUtility";
import type { Extension } from "@Core/Extension";
import type { FileSystemUtility } from "@Core/FileSystemUtility";
import type { Logger } from "@Core/Logger";
import type { SettingsManager } from "@Core/SettingsManager";
import { SearchResultItemActionUtility, type OperatingSystem, type SearchResultItem } from "@common/Core";
import { getExtensionSettingKey, type Translations } from "@common/Core/Extension";
import type { Image } from "@common/Core/Image";
import type { App } from "electron";
import { basename } from "path";

export class FileSearch implements Extension {
    public readonly id = "FileSearch";
    public readonly name = "File Search";

    public readonly nameTranslation = {
        key: "extensionName",
        namespace: "extension[FileSearch]",
    };

    public readonly author = {
        name: "Oliver Schwendener",
        githubUserName: "oliverschwendener",
    };

    private readonly defaultSettings = {
        maxSearchResultCount: 20,
    };

    public constructor(
        private readonly operatingSystem: OperatingSystem,
        private readonly assetPathResolver: AssetPathResolver,
        private readonly commandlineUtility: CommandlineUtility,
        private readonly fileSystemUtility: FileSystemUtility,
        private readonly settingsManager: SettingsManager,
        private readonly app: App,
        private readonly logger: Logger,
    ) {}

    public async getSearchResultItems(): Promise<SearchResultItem[]> {
        return [
            {
                defaultAction: SearchResultItemActionUtility.createInvokeExtensionAction({
                    extensionId: this.id,
                    description: "Search files",
                }),
                description: "File Search",
                id: "file-search:invoke",
                image: this.getImage(),
                name: "Search files",
            },
        ];
    }

    public isSupported(): boolean {
        return this.operatingSystem === "macOS";
    }

    public getSettingDefaultValue<T>(key: string): T {
        return this.defaultSettings[key] as T;
    }

    public getImage(): Image {
        const fileNames: Record<OperatingSystem, string> = {
            Linux: null, // Currently not supported,
            macOS: "macos-folder-icon.png",
            Windows: null, // Currently not supported,
        };

        return {
            url: `file://${this.assetPathResolver.getExtensionAssetPath(this.id, fileNames[this.operatingSystem])}`,
        };
    }

    public getTranslations(): Translations {
        return {
            "en-US": {
                extensionName: "File Search",
            },
            "de-CH": {
                extensionName: "Dateisuche",
            },
        };
    }

    public getSettingKeysTriggeringRescan?(): string[] {
        return ["general.settings"];
    }

    public async invoke({ searchTerm }: { searchTerm: string }): Promise<SearchResultItem[]> {
        const filePaths = await this.getFilePathsBySearchTerm(searchTerm);
        const filePathIconMap = await this.getFileIconMap(filePaths);

        return filePaths.map((filePath) => {
            const isDirectory = this.fileSystemUtility.isDirectory(filePath);

            return {
                defaultAction: SearchResultItemActionUtility.createOpenFileAction({
                    filePath,
                    description: `Open ${isDirectory ? "Folder" : "File"}`,
                }),
                description: isDirectory ? "Folder" : "File",
                id: `file-search-result:${Buffer.from(filePath).toString("base64")}`,
                image: { url: filePathIconMap[filePath] },
                name: basename(filePath),
            };
        });
    }

    private async getFilePathsBySearchTerm(searchTerm: string): Promise<string[]> {
        const maxSearchResultCount = this.getMaxSearchResultCount();
        const commands = [`mdfind -name "${searchTerm}"`, `head -n ${maxSearchResultCount}`];
        const stdout = await this.commandlineUtility.executeCommandWithOutput(commands.join(" | "), true);
        return stdout.split("\n").filter((filePath) => filePath.trim().length > 0);
    }

    private getMaxSearchResultCount(): number {
        return this.settingsManager.getValue(
            getExtensionSettingKey(this.id, "maxSearchResultCount"),
            this.defaultSettings.maxSearchResultCount,
        );
    }

    private async getFileIconMap(filePaths: string[]): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        const promiseResults = await Promise.allSettled(filePaths.map((filePath) => this.app.getFileIcon(filePath)));

        for (let i = 0; i < promiseResults.length; i++) {
            const promiseResult = promiseResults[i];

            if (promiseResult.status === "fulfilled") {
                result[filePaths[i]] = promiseResult.value.toDataURL();
            } else if (promiseResult.status === "rejected") {
                this.logger.error(
                    `Failed to generate icon for file path "${filePaths[i]}". Reason: ${promiseResult.reason}`,
                );
            }
        }

        return result;
    }
}