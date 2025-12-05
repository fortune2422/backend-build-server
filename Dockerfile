FROM openjdk:17

ENV ANDROID_SDK_ROOT=/sdk
ENV PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator

RUN apt-get update && apt-get install -y wget unzip curl git zip unzip zipalign build-essential

# create SDK folders
RUN mkdir -p $ANDROID_SDK_ROOT/cmdline-tools
WORKDIR /tmp

# Download commandline tools
RUN wget -O cmdline.zip "https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip" \
  && unzip cmdline.zip -d $ANDROID_SDK_ROOT/cmdline-tools \
  && rm cmdline.zip

ENV PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/bin

# Accept licenses and install essentials
RUN yes | $ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager --sdk_root=${ANDROID_SDK_ROOT} --licenses
RUN $ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager --sdk_root=${ANDROID_SDK_ROOT} "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# node
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs

WORKDIR /app
COPY package.json /app/
RUN npm install

COPY . /app

EXPOSE 3000
CMD ["node", "index.js"]
