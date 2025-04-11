export const CelShader = {
    vert: `
        uniform vec3 lightDirection;

        varying vec3 vNormal;
        varying vec3 vLightDir;
        varying vec3 vWorldPos;

        void main() {
            // Transform and normalize the normal into view-space.
            vNormal = normalize(normalMatrix * normal);

            // Transform the light direction from world space into view space.
            vLightDir = normalize((modelViewMatrix * vec4(lightDirection, 0.0)).xyz);

            // Transform the vertex position into world space.
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            
            // Calculate the clip-space position.
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    frag: `
        precision mediump float;

        uniform vec3 lightColor;
        uniform vec3 tintColor;
        uniform sampler2D colorRamp;

        #ifdef SPECULAR_ENABLED
            uniform vec3 specularColor;
            uniform float glossiness;
            uniform sampler2D specularRamp;
        #endif

        varying vec3 vNormal;
        varying vec3 vLightDir;
        varying vec3 vWorldPos;

        void main() {
            // Diffuse shading
            vec3 normal = normalize(vNormal);
            float NdotL = max(dot(normal, -vLightDir), 0.0);
            float brightness = texture2D(colorRamp, vec2(NdotL, 0.5)).r;
            vec3 color = tintColor * brightness * lightColor;

            #ifdef SPECULAR_ENABLED
                // Compute half-vector: we add the view direction
                // to the incoming light direction (-vLightDir) and normalize.
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                vec3 halfVector = normalize(-vLightDir + viewDir);
                
                float NdotH = max(dot(normal, halfVector), 0.0);
                
                // The specular intensity is raised to the glossiness power.
                float specularIntensity = pow(NdotH, glossiness);
                
                // Lookup the specular term in the specular ramp.
                float specFactor = texture2D(specularRamp, vec2(specularIntensity, 0.5)).r;
                
                // Multiply by the specular color, then add to the overall color.
                color += specularColor * specFactor;
            #endif

            gl_FragColor = vec4(color, 1.0);
        }
    `
};
