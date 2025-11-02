export class MLP {
  constructor(inputSize : number, hiddenSize: number, outputSize : number, learningRate = 0.1) {
    this.learningRate = learningRate;
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    this.weightsInputHidden = Array.from({length: hiddenSize}, () =>
      Array.from({length: inputSize}, () => Math.random() * 2 - 1)
    );

    this.weightsHiddenOutput = Array.from({length: outputSize}, () =>
      Array.from({length: hiddenSize}, () => Math.random() * 2 - 1)
    );

    this.biasHidden = Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1);
    this.biasOutput = Array.from({ length: outputSize }, () => Math.random() * 2 - 1);
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  sigmoidDerivative(x) {
    return x * (1 - x);
  }

  feedforward(input) {
    this.hidden = this.weightsInputHidden.map((weights, i) => {
      let sum = weights.reduce((acc, w, j) => acc + w * input[j], 0) + this.biasHidden[i];
      return this.sigmoid(sum);
    });

    this.output = this.weightsHiddenOutput.map((weights, i) => {
      let sum = weights.reduce((acc, w, j) => acc + w * this.hidden[j], 0) + this.biasOutput[i];
      return this.sigmoid(sum);
    });

    return this.output;
  }

  train(input, target) {
    this.feedforward(input);

    let outputErrors = this.output.map((out, i) => target[i] - out);
    let outputGradients = this.output.map((out, i) => outputErrors[i] * this.sigmoidDerivative(out) * this.learningRate);

    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weightsHiddenOutput[i][j] += outputGradients[i] * this.hidden[j];
      }
      this.biasOutput[i] += outputGradients[i];
    }

    let hiddenErrors = Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let i = 0; i < this.outputSize; i++) {
        hiddenErrors[j] += outputErrors[i] * this.weightsHiddenOutput[i][j];
      }
    }

    let hiddenGradients = this.hidden.map((h, j) => hiddenErrors[j] * this.sigmoidDerivative(h) * this.learningRate);

    for (let j = 0; j < this.hiddenSize; j++) {
      for (let k = 0; k < this.inputSize; k++) {
        this.weightsInputHidden[j][k] += hiddenGradients[j] * input[k];
      }
      this.biasHidden[j] += hiddenGradients[j];
    }
  }

  predict(input) {
    let output = this.feedforward(input);
    let maxIndex = 0;
    for (let i = 1; i < output.length; i++) {
      if (output[i] > output[maxIndex]) maxIndex = i;
    }
    return maxIndex;
  }

  save() {
    return JSON.stringify({
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      learningRate: this.learningRate,
      weightsInputHidden: this.weightsInputHidden,
      weightsHiddenOutput: this.weightsHiddenOutput,
      biasHidden: this.biasHidden,
      biasOutput: this.biasOutput
    });
  }

  load(jsonString: string) {
    const data = JSON.parse(jsonString);
    this.inputSize = data.inputSize;
    this.hiddenSize = data.hiddenSize;
    this.outputSize = data.outputSize;
    this.learningRate = data.learningRate;
    this.weightsInputHidden = data.weightsInputHidden;
    this.weightsHiddenOutput = data.weightsHiddenOutput;
    this.biasHidden = data.biasHidden;
    this.biasOutput = data.biasOutput;
  }
}
