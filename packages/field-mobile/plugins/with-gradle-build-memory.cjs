const { withGradleProperties } = require('expo/config-plugins');

const BUILD_PROPERTIES = {
    'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
    'org.gradle.parallel': 'false',
    'org.gradle.workers.max': '2',
};

module.exports = function withGradleBuildMemory(config) {
    return withGradleProperties(config, (config) => {
        for (const [key, value] of Object.entries(BUILD_PROPERTIES)) {
            const existingProperty = config.modResults.find(
                (item) => item.type === 'property' && item.key === key,
            );

            if (existingProperty) {
                existingProperty.value = value;
            } else {
                config.modResults.push({
                    type: 'property',
                    key,
                    value,
                });
            }
        }

        return config;
    });
};
