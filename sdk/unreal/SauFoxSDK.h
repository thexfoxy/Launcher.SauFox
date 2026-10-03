// SauFox launcher SDK for Unreal Engine 5 (C++ and Blueprints).
//
// Copy SauFoxSDK.h and SauFoxSDK.cpp into your game module's Source folder
// (e.g. Source/MyGame/), replace MYGAME_API with your module's API macro,
// and add "HTTP", "Json" and "JsonUtilities" to PublicDependencyModuleNames
// in MyGame.Build.cs. Then, from C++ or any Blueprint:
//
//   USauFoxSDK::UnlockAchievement("first_steps");
//   USauFoxSDK::SaveGameToSauFox(MySaveGame, "Slot1");   // instead of SaveGameToSlot
//   USauFoxSDK::LoadGameFromSauFox("Slot1");             // instead of LoadGameFromSlot
//
// Saves made this way go to the folder the launcher keeps in the cloud.
// Started any other way (the editor, a packaged build run by hand),
// achievements are skipped quietly and saves go to Saved/SaveGames, so the
// game always runs.
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "SauFoxSDK.generated.h"

class USaveGame;

UCLASS()
class MYGAME_API USauFoxSDK : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** True when the SauFox launcher started the game. */
	UFUNCTION(BlueprintPure, Category = "SauFox")
	static bool IsAvailable();

	/** Unlock an achievement by its key (as set in the admin panel). Safe to call again. */
	UFUNCTION(BlueprintCallable, Category = "SauFox")
	static void UnlockAchievement(const FString& Key);

	/** The folder for save files, synced with the cloud by the launcher. */
	UFUNCTION(BlueprintPure, Category = "SauFox")
	static FString GetSaveDir();

	/** Like SaveGameToSlot, into the cloud-synced folder. */
	UFUNCTION(BlueprintCallable, Category = "SauFox")
	static bool SaveGameToSauFox(USaveGame* SaveGame, const FString& SlotName);

	/** Like LoadGameFromSlot, from the cloud-synced folder. Null when there's no save. */
	UFUNCTION(BlueprintCallable, Category = "SauFox")
	static USaveGame* LoadGameFromSauFox(const FString& SlotName);

	/** Whether a save exists in the cloud-synced folder. */
	UFUNCTION(BlueprintPure, Category = "SauFox")
	static bool DoesSauFoxSaveExist(const FString& SlotName);
};
