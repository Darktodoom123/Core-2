const { withGradleProperties } = require('expo/config-plugins');

const PROPERTY_NAME = 'org.gradle.problems.report';

module.exports = function withGradleProblemsReport(config) {
    return withGradleProperties(config, (config) => {
        const existingProperty = config.modResults.find(
            (item) => item.type === 'property' && item.key === PROPERTY_NAME,
        );

        if (existingProperty) {
            existingProperty.value = 'false';
        } else {
            config.modResults.push({
                type: 'property',
                key: PROPERTY_NAME,
                value: 'false',
            });
        }

        return config;
    });
};
