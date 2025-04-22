import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

export class WebhooksLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const webhookLambda = new lambda.Function(this, "WebhookLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: "src.main.handler",
      code: lambda.Code.fromAsset("functions/webhook-lambda", {
        bundling: {
          image: lambda.Runtime.PYTHON_3_10.bundlingImage,
          command: [
            "bash",
            "-c",
            "pip install -r src/requirements.txt -t /asset-output --platform manylinux2014_x86_64 --only-binary=:all: && cp -au . /asset-output",
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        PYTHONPATH:
          "/var/runtime:/opt/python/lib/python3.10/site-packages:/opt/python",
      },
      description: "Lambda function to send pipeline status to Discord",
    });

    webhookLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "codepipeline:GetPipelineExecution",
          "codepipeline:ListPipelineExecutions",
          "codepipeline:GetPipelineState",
        ],
        resources: ["*"],
      })
    );

    webhookLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );

    const pipelineStateChangeRule = new events.Rule(
      this,
      "PipelineStateChangeRule",
      {
        description: "Rule to capture CodePipeline state changes",
        eventPattern: {
          source: ["aws.codepipeline"],
          detailType: ["CodePipeline Pipeline Execution State Change"],
        },
      }
    );

    pipelineStateChangeRule.addTarget(
      new targets.LambdaFunction(webhookLambda)
    );

    const stageStateChangeRule = new events.Rule(this, "StageStateChangeRule", {
      description: "Rule to capture CodePipeline stage state changes",
      eventPattern: {
        source: ["aws.codepipeline"],
        detailType: ["CodePipeline Stage Execution State Change"],
      },
    });
    stageStateChangeRule.addTarget(new targets.LambdaFunction(webhookLambda));

    const actionStateChangeRule = new events.Rule(
      this,
      "ActionStateChangeRule",
      {
        description: "Rule to capture CodePipeline action state changes",
        eventPattern: {
          source: ["aws.codepipeline"],
          detailType: ["CodePipeline Action Execution State Change"],
        },
      }
    );
    actionStateChangeRule.addTarget(new targets.LambdaFunction(webhookLambda));

    new cdk.CfnOutput(this, "MonitorLambdaFunctionName", {
      value: webhookLambda.functionName,
      description: "Name of the Lambda function monitoring CodePipeline events",
    });
  }
}
