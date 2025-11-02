
export interface TaskRankerSettings {
	displayLimit: number;
	hiddenLayerNum: number;
	learningRate: number;
	retrain: boolean;
    shortTermImpactWeight: number;
    longTermImpactWeight: number;
    fullImpactWeight: number;
    effortLevelWeight: number;
    jsonSavePath: string
    trainingEpochs: number;
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
    jsonSavePath: "jsondata.txt",
    trainingEpochs: 1000
}
