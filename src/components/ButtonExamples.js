import React from 'react';
import { View, StyleSheet } from 'react-native';
import { 
  Button, 
  IconButton, 
  FAB, 
  Chip,
  Card,
  Title,
  Paragraph
} from 'react-native-paper';

const ButtonExamples = () => {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Примеры кнопок React Native Paper</Title>
          
          {/* Обычные кнопки */}
          <View style={styles.section}>
            <Paragraph>Обычные кнопки:</Paragraph>
            <Button 
              mode="contained" 
              onPress={() => console.log('Contained pressed')}
              style={styles.button}
            >
              Contained Button
            </Button>
            
            <Button 
              mode="outlined" 
              onPress={() => console.log('Outlined pressed')}
              style={styles.button}
            >
              Outlined Button
            </Button>
            
            <Button 
              mode="text" 
              onPress={() => console.log('Text pressed')}
              style={styles.button}
            >
              Text Button
            </Button>
          </View>

          {/* Кнопки с иконками */}
          <View style={styles.section}>
            <Paragraph>Кнопки с иконками:</Paragraph>
            <Button 
              mode="contained" 
              icon="login" 
              onPress={() => console.log('Login pressed')}
              style={styles.button}
            >
              Войти
            </Button>
            
            <Button 
              mode="outlined" 
              icon="logout" 
              onPress={() => console.log('Logout pressed')}
              style={styles.button}
            >
              Выйти
            </Button>
            
            <Button 
              mode="contained" 
              icon="camera" 
              onPress={() => console.log('Camera pressed')}
              style={styles.button}
            >
              Сделать фото
            </Button>
          </View>

          {/* Иконки-кнопки */}
          <View style={styles.section}>
            <Paragraph>Иконки-кнопки:</Paragraph>
            <View style={styles.iconRow}>
              <IconButton
                icon="home"
                size={24}
                onPress={() => console.log('Home pressed')}
              />
              <IconButton
                icon="settings"
                size={24}
                onPress={() => console.log('Settings pressed')}
              />
              <IconButton
                icon="account"
                size={24}
                onPress={() => console.log('Account pressed')}
              />
              <IconButton
                icon="bell"
                size={24}
                onPress={() => console.log('Notifications pressed')}
              />
            </View>
          </View>

          {/* FAB (Floating Action Button) */}
          <View style={styles.section}>
            <Paragraph>Floating Action Button:</Paragraph>
            <FAB
              icon="plus"
              style={styles.fab}
              onPress={() => console.log('FAB pressed')}
            />
          </View>

          {/* Chips */}
          <View style={styles.section}>
            <Paragraph>Chips:</Paragraph>
            <View style={styles.chipRow}>
              <Chip 
                icon="check" 
                onPress={() => console.log('Chip 1 pressed')}
                style={styles.chip}
              >
                Активен
              </Chip>
              <Chip 
                icon="clock" 
                onPress={() => console.log('Chip 2 pressed')}
                style={styles.chip}
              >
                В работе
              </Chip>
              <Chip 
                icon="map-marker" 
                onPress={() => console.log('Chip 3 pressed')}
                style={styles.chip}
              >
                На месте
              </Chip>
            </View>
          </View>

          {/* Кнопки для вашего приложения */}
          <View style={styles.section}>
            <Paragraph>Для Workforce Tracker:</Paragraph>
            <Button 
              mode="contained" 
              icon="play" 
              onPress={() => console.log('Start shift')}
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
            >
              Открыть смену
            </Button>
            
            <Button 
              mode="contained" 
              icon="stop" 
              onPress={() => console.log('End shift')}
              style={[styles.button, { backgroundColor: '#F44336' }]}
            >
              Закрыть смену
            </Button>
            
            <Button 
              mode="outlined" 
              icon="camera" 
              onPress={() => console.log('Take photo')}
              style={styles.button}
            >
              Сделать фото
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  button: {
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  fab: {
    alignSelf: 'center',
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
});

export default ButtonExamples;
