'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DETOX_VERSION = require('detox/package.json').version;
const {
    AndroidConfig,
    withAppBuildGradle,
    withDangerousMod,
    withProjectBuildGradle,
} = require('expo/config-plugins');

const DETOX_GRADLE_MARKER = '// Core 2 Detox instrumentation';
const DETOX_MAVEN_MARKER = '// Core 2 local Detox Maven repository';

function withDetoxMavenRepository(config) {
    return withProjectBuildGradle(config, (gradleConfig) => {
        if (gradleConfig.modResults.language !== 'groovy') {
            throw new Error(
                'The Core 2 Detox plugin currently requires a Groovy build.gradle.',
            );
        }

        let source = gradleConfig.modResults.contents;

        if (!source.includes(DETOX_MAVEN_MARKER)) {
            source = source.replace(
                /allprojects\s*\{\s*repositories\s*\{/,
                `allprojects {
  repositories {
    ${DETOX_MAVEN_MARKER}
    maven {
      def detoxPackage = new File(
        ["node", "--print", "require.resolve('detox/package.json')"].execute(null, rootDir).text.trim()
      )
      url new File(detoxPackage.parentFile, "Detox-android")
      content {
        includeModule "com.wix", "detox"
      }
    }`,
            );
        }

        gradleConfig.modResults.contents = source;

        return gradleConfig;
    });
}

function withDetoxGradle(config) {
    return withAppBuildGradle(config, (gradleConfig) => {
        if (gradleConfig.modResults.language !== 'groovy') {
            throw new Error(
                'The Core 2 Detox plugin currently requires a Groovy app/build.gradle.',
            );
        }

        let source = gradleConfig.modResults.contents;

        if (!source.includes(DETOX_GRADLE_MARKER)) {
            source = source.replace(
                /defaultConfig\s*\{/,
                `defaultConfig {\n        ${DETOX_GRADLE_MARKER}\n        testBuildType System.getProperty('testBuildType', 'debug')\n        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'\n        missingDimensionStrategy 'detox', 'full'`,
            );
            source = source.replace(
                /dependencies\s*\{/,
                `dependencies {\n    ${DETOX_GRADLE_MARKER}\n    androidTestImplementation('com.wix:detox:${DETOX_VERSION}')\n    implementation 'androidx.appcompat:appcompat:1.7.1'`,
            );
        }

        gradleConfig.modResults.contents = source;

        return gradleConfig;
    });
}

function withDetoxTest(config) {
    return withDangerousMod(config, [
        'android',
        async (dangerousConfig) => {
            const packageName =
                AndroidConfig.Package.getPackage(dangerousConfig);

            if (!packageName) {
                throw new Error(
                    'An Android package is required before generating DetoxTest.java.',
                );
            }

            const packagePath = packageName.replaceAll('.', path.sep);
            const testDirectory = path.join(
                dangerousConfig.modRequest.platformProjectRoot,
                'app',
                'src',
                'androidTest',
                'java',
                packagePath,
            );
            const testSource = `package ${packageName};

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> activityRule =
        new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = BuildConfig.DEBUG ? 180 : 60;

        Detox.runTests(activityRule, detoxConfig);
    }
}
`;

            fs.mkdirSync(testDirectory, { recursive: true });
            fs.writeFileSync(
                path.join(testDirectory, 'DetoxTest.java'),
                testSource,
            );

            return dangerousConfig;
        },
    ]);
}

module.exports = function withDetoxAndroid(config) {
    return withDetoxTest(withDetoxGradle(withDetoxMavenRepository(config)));
};
