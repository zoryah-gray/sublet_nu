import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'SubletNU');

    const alertEmail = this.node.tryGetContext('alertEmail') ?? process.env.ALERT_EMAIL;
    if (!alertEmail) {
      throw new Error('Set alertEmail via -c alertEmail=... or the ALERT_EMAIL env var');
    }

    const billingAlertsTopic = new sns.Topic(this, 'BillingAlertsTopic', {
      topicName: 'subletnu-billing-alerts',
    });
    billingAlertsTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));
    billingAlertsTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowBudgetsPublish',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [billingAlertsTopic.topicArn],
        conditions: {
          StringEquals: { 'aws:SourceAccount': cdk.Aws.ACCOUNT_ID },
        },
      })
    );

    const snsSubscriber = (): budgets.CfnBudget.SubscriberProperty => ({
      subscriptionType: 'SNS',
      address: billingAlertsTopic.topicArn,
    });

    const notification = (
      notificationType: 'ACTUAL' | 'FORECASTED',
      threshold: number
    ): budgets.CfnBudget.NotificationWithSubscribersProperty => ({
      notification: {
        notificationType,
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers: [snsSubscriber()],
    });

    // $10/month actual spend, warns at 80% and alerts at 100%.
    new budgets.CfnBudget(this, 'ActualBudget10', {
      budget: {
        budgetName: 'subletnu-actual-10',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 10, unit: 'USD' },
      },
      notificationsWithSubscribers: [notification('ACTUAL', 80), notification('ACTUAL', 100)],
    });

    // $25/month actual spend, alerts at 100%.
    new budgets.CfnBudget(this, 'ActualBudget25', {
      budget: {
        budgetName: 'subletnu-actual-25',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 25, unit: 'USD' },
      },
      notificationsWithSubscribers: [notification('ACTUAL', 100)],
    });

    // $50/month actual spend — circuit breaker above the $30 target, not the target itself.
    new budgets.CfnBudget(this, 'ActualBudget50', {
      budget: {
        budgetName: 'subletnu-actual-50',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 50, unit: 'USD' },
      },
      notificationsWithSubscribers: [notification('ACTUAL', 100)],
    });

    // $30/month forecasted spend, alerts at 100% of the forecast.
    new budgets.CfnBudget(this, 'ForecastedBudget30', {
      budget: {
        budgetName: 'subletnu-forecasted-30',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 30, unit: 'USD' },
      },
      notificationsWithSubscribers: [notification('FORECASTED', 100)],
    });

    // example resource
    // const queue = new sqs.Queue(this, 'BackendQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
