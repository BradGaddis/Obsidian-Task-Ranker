import { MLP } from "./mlp/mlp"


export interface TaskRankerSettings {
	displayLimit: number;
	hiddenLayerNum: number;
	learningRate: number;
	retrain: boolean;
    shortTermImpactWeight: number;
    longTermImpactWeight: number;
    fullImpactWeight: number;
    effortLevelWeight: number;
    trainingDataSavePath: string
    trainingEpochs: number;
    modelSavePath: string
    mlp: null | MLP
}


export const DEFAULT_SETTINGS: TaskRankerSettings = {
    displayLimit: 10,
	hiddenLayerNum: 50,
	learningRate: .01,
	retrain: true,
    shortTermImpactWeight: .03,
    longTermImpactWeight: .1,
    fullImpactWeight: .07,
    effortLevelWeight: .1,
    trainingDataSavePath: "rankeddata.txt",
    modelSavePath: "rankedmodeldata.txt",
    trainingEpochs: 1000,
    mlp: null
}
